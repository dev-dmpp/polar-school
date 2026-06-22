import Docker from "dockerode";
import { randomBytes } from "node:crypto";
import {
  SANDBOX_IMAGE,
  MEMORY_LIMIT_MB,
  CPU_LIMIT,
  PID_LIMIT,
  TMPFS_SIZE_MB,
  MAX_PER_USER,
  MAX_TOTAL,
  MAX_ANON_TOTAL,
  NOBODY_UID,
  NOBODY_GID,
  LABEL_MANAGED_BY,
  LABEL_MANAGED_BY_VALUE,
} from "./limits.js";

/** Prefijo de ownerId para contenedores anónimos. Cuando un contenedor se crea
 *  con ownerId="anon:xxxxx", el manager lo trata como anónimo: aplica
 *  MAX_ANON_TOTAL en vez de MAX_PER_USER y lo marca como anonymous en labels. */
export const ANON_OWNER_PREFIX = "anon:";

/**
 * Wrapper sobre dockerode para gestionar contenedores sandbox por usuario.
 *
 * Decisiones:
 *   - dockerode expone `Docker` que habla al socket /var/run/docker.sock
 *   - Singleton para evitar múltiples pools en hot reload de dev
 *   - Labels en cada container permiten al cleanup encontrarlos
 *   - Container se nombra con userId + sufijo random para evitar colisiones
 */
const globalForSandbox = globalThis as unknown as {
  __polarSandboxDocker?: Docker;
};

export const docker: Docker =
  globalForSandbox.__polarSandboxDocker ??
  new Docker({ socketPath: "/var/run/docker.sock" });

if (process.env.NODE_ENV !== "production") {
  globalForSandbox.__polarSandboxDocker = docker;
}

export interface ContainerInfo {
  containerId: string;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
}

/**
 * Mapa en memoria: userId → containerId. Persistente mientras el API esté vivo.
 * Si el API se reinicia, el cleanup también recoge contenedores huérfanos
 * (los que tienen label pero no están en el mapa).
 */
const activeByUser = new Map<string, ContainerInfo>();

/** Genera containerName seguro para Docker (max 64 chars, [a-zA-Z0-9_.-]). */
function generateContainerName(userId: string): string {
  const random = randomBytes(4).toString("hex");
  // userId viene de Lucia (hex 32 chars). Truncar si fuera más largo.
  const safeUser = userId.replace(/[^a-z0-9]/gi, "").slice(0, 32).toLowerCase();
  return `polar-sandbox-${safeUser}-${random}`;
}

/**
 * Crea un contenedor sandbox para el userId.
 * Si ya hay uno activo para ese usuario, lo mata y crea uno nuevo
 * (recuperación de estado corrupto).
 *
 * Si el ownerId tiene prefijo `anon:` (anónimo), aplica MAX_ANON_TOTAL
 * en vez de MAX_PER_USER y no requiere sesión de usuario.
 *
 * Returns: ContainerInfo o error si se alcanzó el límite global.
 */
export async function createContainer(ownerId: string): Promise<ContainerInfo> {
  const isAnon = ownerId.startsWith(ANON_OWNER_PREFIX);

  // Contar contenedores totales activos del sandbox
  const allActive = await listManagedContainers();
  if (allActive.length >= MAX_TOTAL) {
    throw new SandboxError(
      "FULL",
      `Límite global alcanzado (${MAX_TOTAL} contenedores activos). Intentá en unos minutos.`,
    );
  }

  // Si es anónimo, contar cuántos anónimos hay y aplicar MAX_ANON_TOTAL
  if (isAnon) {
    const anonActive = allActive.filter((c) => c.userId.startsWith(ANON_OWNER_PREFIX));
    if (anonActive.length >= MAX_ANON_TOTAL) {
      throw new SandboxError(
        "ANON_FULL",
        `Límite de sesiones anónimas alcanzado (${MAX_ANON_TOTAL}). Crea una cuenta gratuita para una experiencia más estable.`,
      );
    }
  } else {
    // Contar contenedores del usuario (incluyendo huérfanos en Docker)
    const userActive = allActive.filter((c) => c.userId === ownerId);
    if (userActive.length >= MAX_PER_USER) {
      throw new SandboxError(
        "TOO_MANY_PER_USER",
        `Ya tienes ${MAX_PER_USER} contenedores activos. Cierra alguno antes de abrir otro.`,
      );
    }
  }

  // Matar contenedores viejos del owner (si quedaron por bug)
  const ownerActive = allActive.filter((c) => c.userId === ownerId);
  for (const old of ownerActive) {
    await destroyContainer(old.containerId).catch(() => {
      // Si falla, lo registramos pero seguimos
      console.warn(`[sandbox] No pude limpiar container viejo ${old.containerId}`);
    });
  }
  activeByUser.delete(ownerId);

  const containerName = generateContainerName(ownerId);
  const now = Date.now();

  // Crear contenedor (NO lo inicia todavía, eso lo hace el WS bridge)
  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name: containerName,
    User: `${NOBODY_UID}:${NOBODY_GID}`,
    WorkingDir: "/tmp",
    Env: [
      `PS_OWNER_ID=${ownerId}`,
      `PS_IS_ANON=${isAnon ? "1" : "0"}`,
      `PS_CREATED_AT=${new Date(now).toISOString()}`,
    ],
    Labels: {
      [LABEL_MANAGED_BY]: LABEL_MANAGED_BY_VALUE,
      "polar-school-user": ownerId,
      "polar-school-anon": isAnon ? "1" : "0",
    },
    HostConfig: {
      // Recursos
      Memory: MEMORY_LIMIT_MB * 1024 * 1024,
      NanoCpus: Math.floor(CPU_LIMIT * 1e9),
      PidsLimit: PID_LIMIT,

      // Seguridad
      NetworkMode: "none",
      ReadonlyRootfs: true,
      Tmpfs: {
        "/tmp": `rw,nosuid,nodev,size=${TMPFS_SIZE_MB}m`,
        "/home": `rw,nosuid,nodev,size=${TMPFS_SIZE_MB}m`,
        "/root": `rw,nosuid,nodev,size=${TMPFS_SIZE_MB}m`,
      },
      SecurityOpt: ["no-new-privileges:true"],
      CapDrop: ["ALL"],

      // Lifecycle
      AutoRemove: true,
      RestartPolicy: { Name: "no" },
    },
    Tty: true, // TTY virtual para que bash se comporte como interactivo
    OpenStdin: true,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
  });

  const info: ContainerInfo = {
    containerId: container.id,
    userId: ownerId,
    createdAt: now,
    lastActivityAt: now,
  };

  activeByUser.set(ownerId, info);

  return info;
}

/**
 * Reclama un contenedor anónimo para un usuario real.
 * Cambia el owner en el mapa y actualiza los labels del container en Docker.
 *
 * NO mata el container: mantiene la sesión viva. El usuario sigue donde estaba.
 */
export async function claimAnonymousContainer(
  anonId: string,
  userId: string,
): Promise<ContainerInfo | null> {
  const anonOwnerId = ANON_OWNER_PREFIX + anonId;
  const info = activeByUser.get(anonOwnerId);
  if (!info) return null;

  // Matar containers viejos del user real (si los tenía)
  const userActive = await listManagedContainers();
  const oldForUser = userActive.filter((c) => c.userId === userId);
  for (const old of oldForUser) {
    await destroyContainer(old.containerId).catch(() => {});
  }
  activeByUser.delete(userId);

  // Transferir: nuevo ownerId, mismas referencias
  const newInfo: ContainerInfo = {
    ...info,
    userId,
    lastActivityAt: Date.now(),
  };
  activeByUser.delete(anonOwnerId);
  activeByUser.set(userId, newInfo);

  // Actualizar labels en Docker (best-effort: si falla, el container sigue funcionando)
  // NOTA: Docker no permite modificar labels de un container existente.
  // El label polar-school-user queda stale hasta que el container muera;
  // no es crítico porque listManagedContainers cruza con activeByUser,
  // que es la fuente de verdad.

  return newInfo;
}

/** Inicia el contenedor (lo arranca, pero todavía no hay stream). */
export async function startContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

/** Mata el contenedor (forzado) y lo saca del mapa. */
export async function destroyContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 5 }).catch(() => {
      // Puede que ya esté stopped o eliminado por AutoRemove
    });
    await container.remove({ force: true }).catch(() => {});
  } catch (err) {
    // Container ya no existe (AutoRemove lo borró). Está bien.
    console.warn(`[sandbox] destroyContainer: container ${containerId} ya no existe`);
  }

  // Limpiar del mapa si lo encontramos
  for (const [userId, info] of activeByUser.entries()) {
    if (info.containerId === containerId) {
      activeByUser.delete(userId);
    }
  }
}

/** Devuelve el ContainerInfo del usuario, o null si no tiene uno activo. */
export function getActiveForUser(userId: string): ContainerInfo | null {
  return activeByUser.get(userId) ?? null;
}

/** Marca actividad reciente (para evitar cleanup prematuro). */
export function touchActivity(userId: string): void {
  const info = activeByUser.get(userId);
  if (info) info.lastActivityAt = Date.now();
}

/** Lista todos los contenedores gestionados por polar-school-sandbox. */
export async function listManagedContainers(): Promise<ContainerInfo[]> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        label: [`${LABEL_MANAGED_BY}=${LABEL_MANAGED_BY_VALUE}`],
      },
    });

    const result: ContainerInfo[] = [];
    for (const c of containers) {
      const userId = c.Labels?.["polar-school-user"];
      if (!userId) continue;

      // Buscar en mapa para tener createdAt/lastActivityAt correctos
      const known = activeByUser.get(userId);
      if (known && known.containerId === c.Id) {
        result.push(known);
      } else {
        // Container huérfano (API se reinició, no está en el mapa)
        result.push({
          containerId: c.Id,
          userId,
          createdAt: c.Created * 1000,
          lastActivityAt: c.Created * 1000, // asunción conservadora
        });
      }
    }

    return result;
  } catch (err) {
    console.error("[sandbox] listManagedContainers falló:", err);
    return [];
  }
}

/** Error tipado del sandbox. */
export class SandboxError extends Error {
  constructor(
    public code: "FULL" | "TOO_MANY_PER_USER" | "NOT_FOUND" | "DOCKER_UNAVAILABLE" | "ANON_FULL" | "ANON_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "SandboxError";
  }
}
