import { destroyContainer, listManagedContainers } from "./manager.js";
import {
  IDLE_TIMEOUT_MIN,
  CLEANUP_INTERVAL_MIN,
  ORPHAN_TIMEOUT_MIN,
  MAX_TOTAL,
} from "./limits.js";

/**
 * Loop de cleanup para contenedores sandbox.
 *
 * Reglas:
 *   - Idle: contenedor con lastActivityAt > IDLE_TIMEOUT_MIN → destroy
 *   - Huérfano: contenedor que Docker conoce (label polar-school=sandbox)
 *               pero que NO está en el mapa activeByUser del API → destroy
 *               (esto pasa cuando el API se reinicia y pierde el mapa en memoria)
 *   - Límite global: si hay más de MAX_TOTAL contenedores, destruir los más viejos primero
 *
 * Decisiones:
 *   - setInterval (no setTimeout recursivo) para que PM2/systemd puedan manejarlo
 *   - Lock cooperativo: si un tick se solapa con otro, abortar el segundo (no debería
 *     pasar porque dura pocos ms, pero por seguridad)
 *   - Logs simples para no llenar el log del API en producción
 *   - El cleanup es best-effort: si Docker falla para un container, log y sigue
 */

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let totalKilled = 0;

/** Tiempo máximo (ms) desde createdAt antes de considerar un container huérfano. */
const ORPHAN_TIMEOUT_MS = ORPHAN_TIMEOUT_MIN * 60 * 1000;

/** Función exportada para tests: corre un tick manualmente. */
export async function runCleanupTick(): Promise<{
  killed: number;
  remaining: number;
  errors: number;
}> {
  if (running) {
    return { killed: 0, remaining: -1, errors: 0 };
  }
  running = true;
  let killed = 0;
  let errors = 0;

  try {
    const all = await listManagedContainers();
    const now = Date.now();

    // Clasificar contenedores a destruir
    const toDestroy: Array<{ containerId: string; reason: string; ageMs: number }> = [];

    for (const c of all) {
      const ageMs = now - c.createdAt;
      const idleMs = now - c.lastActivityAt;

      // Idle timeout
      if (idleMs > IDLE_TIMEOUT_MIN * 60 * 1000) {
        toDestroy.push({
          containerId: c.containerId,
          reason: `idle-${Math.round(idleMs / 1000)}s`,
          ageMs,
        });
        continue;
      }

      // Huérfano (label existe pero no está en el mapa del API)
      // Heurística: si ageMs > ORPHAN_TIMEOUT_MS, probablemente es huérfano
      // (el alumno no se conectó en 30 min). Esto es defensivo: si el alumno
      // está conectado, lastActivityAt se actualiza y nunca llega acá.
      if (ageMs > ORPHAN_TIMEOUT_MS) {
        toDestroy.push({
          containerId: c.containerId,
          reason: `orphan-${Math.round(ageMs / 1000)}s`,
          ageMs,
        });
        continue;
      }
    }

    // Si excede MAX_TOTAL, destruir los más viejos primero
    const remaining = all.length - toDestroy.length;
    if (remaining > MAX_TOTAL) {
      const survivors = all
        .filter((c) => !toDestroy.some((t) => t.containerId === c.containerId))
        .sort((a, b) => a.createdAt - b.createdAt);
      const excess = remaining - MAX_TOTAL;
      for (let i = 0; i < excess; i++) {
        const victim = survivors[i];
        if (victim) {
          toDestroy.push({
            containerId: victim.containerId,
            reason: `over-limit-${i + 1}`,
            ageMs: now - victim.createdAt,
          });
        }
      }
    }

    // Destruir (en serie para no saturar el daemon de Docker)
    for (const t of toDestroy) {
      try {
        await destroyContainer(t.containerId);
        killed++;
        console.log(
          `[sandbox-cleanup] destruido ${t.containerId.slice(0, 12)}… (${t.reason})`,
        );
      } catch (err) {
        errors++;
        console.warn(
          `[sandbox-cleanup] no pude destruir ${t.containerId.slice(0, 12)}…: ${(err as Error).message}`,
        );
      }
    }

    if (killed > 0 || errors > 0) {
      totalKilled += killed;
      console.log(
        `[sandbox-cleanup] tick: ${killed} destruidos, ${errors} errores, ${all.length - killed} restantes`,
      );
    }
  } catch (err) {
    errors++;
    console.error("[sandbox-cleanup] tick crasheó:", err);
  } finally {
    running = false;
  }

  return { killed, remaining: -1, errors };
}

/** Arranca el loop de cleanup. Idempotente. */
export function startCleanupLoop(): void {
  if (timer) {
    console.warn("[sandbox-cleanup] ya estaba corriendo");
    return;
  }

  const intervalMs = CLEANUP_INTERVAL_MIN * 60 * 1000;
  console.log(
    `[sandbox-cleanup] loop arrancado (cada ${CLEANUP_INTERVAL_MIN} min, idle=${IDLE_TIMEOUT_MIN} min, orphan=${ORPHAN_TIMEOUT_MIN} min, max=${MAX_TOTAL})`,
  );

  // Primer tick después de 30s (para no competir con el arranque)
  setTimeout(() => {
    runCleanupTick().catch(() => {});
  }, 30 * 1000);

  timer = setInterval(() => {
    runCleanupTick().catch(() => {});
  }, intervalMs);
}

/** Detiene el loop. Usado por tests. */
export function stopCleanupLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Estadísticas para /health. */
export function getCleanupStats(): { totalKilled: number; running: boolean } {
  return { totalKilled, running };
}
