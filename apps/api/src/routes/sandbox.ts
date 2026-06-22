import { Hono } from "hono";
import { createHash } from "node:crypto";
import { lucia } from "../auth/lucia.js";
import {
  ANON_OWNER_PREFIX,
  claimAnonymousContainer,
  createContainer,
  destroyContainer,
  getActiveForUser,
  startContainer,
  SandboxError,
} from "../sandbox/manager.js";
import {
  ANON_IDLE_TIMEOUT_MIN,
  IDLE_TIMEOUT_MIN,
} from "../sandbox/limits.js";
import { issueSandboxSessionToken } from "../sandbox/session-token.js";

/**
 * Rutas REST para gestionar el sandbox del usuario.
 *
 * Endpoints (logueado):
 *   POST /sandbox/start       → crea + inicia contenedor para user_id
 *   POST /sandbox/stop        → mata contenedor del user_id
 *   GET  /sandbox/status      → estado actual
 *   POST /sandbox/claim       → reclama contenedor anónimo de la misma IP
 *
 * Endpoints (anónimo, sin login):
 *   POST /sandbox/anonymous-start  → crea contenedor anónimo (TTL 5 min)
 */

export const sandboxRoutes = new Hono();

/** Extrae el userId desde el cookie de sesión. Devuelve null si no hay sesión. */
async function getUserIdFromCookie(c: { req: { header: (k: string) => string | undefined } }): Promise<string | null> {
  const sessionId = lucia.readSessionCookie(c.req.header("cookie") ?? "");
  if (!sessionId) return null;
  const { session, user } = await lucia.validateSession(sessionId);
  if (!session || !user) return null;
  return user.id;
}

/**
 * Genera un anonId estable por IP+UA. El user_agent es "salty" para que
 * distintos browsers en la misma IP tengan sesiones separadas.
 *
 * NO usamos sólo IP porque compartir NAT (oficinas, universidades, mobile)
 * haría que varios users compartan el mismo contenedor.
 */
function deriveAnonId(c: { req: { header: (k: string) => string | undefined } }): string {
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const ua = c.req.header("user-agent") ?? "unknown";
  // Usar SHA-256 truncado a 16 chars hex
  return createHash("sha256").update(ip + "|" + ua).digest("hex").slice(0, 16);
}

// POST /sandbox/start (logueado)
sandboxRoutes.post("/start", async (c) => {
  const userId = await getUserIdFromCookie(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  try {
    const existing = getActiveForUser(userId);
    if (existing) {
      // Ya hay uno activo, lo devolvemos en lugar de crear otro.
      // Emitimos un token nuevo por si el cliente perdió el anterior.
      const sessionToken = issueSandboxSessionToken(userId);
      return c.json(
        {
          ok: true,
          containerId: existing.containerId,
          userId,
          idleTimeoutMin: IDLE_TIMEOUT_MIN,
          sessionToken,
          sessionTokenTtlSec: 5 * 60,
          wsPath: "/sandbox/ws",
          reused: true,
        },
        200,
      );
    }

    const info = await createContainer(userId);
    await startContainer(info.containerId);
    const sessionToken = issueSandboxSessionToken(userId);

    return c.json(
      {
        ok: true,
        containerId: info.containerId,
        userId,
        idleTimeoutMin: IDLE_TIMEOUT_MIN,
        sessionToken,
        sessionTokenTtlSec: 5 * 60,
        wsPath: "/sandbox/ws",
        reused: false,
      },
      201,
    );
  } catch (err) {
    if (err instanceof SandboxError) {
      const status = err.code === "FULL" || err.code === "TOO_MANY_PER_USER" ? 429 : 500;
      return c.json({ error: err.message, code: err.code }, status);
    }
    console.error("[sandbox] start falló:", err);
    return c.json({ error: "Error interno al crear sandbox" }, 500);
  }
});

// POST /sandbox/anonymous-start (sin login)
sandboxRoutes.post("/anonymous-start", async (c) => {
  const anonId = deriveAnonId(c);
  const ownerId = ANON_OWNER_PREFIX + anonId;

  try {
    const existing = getActiveForUser(ownerId);
    if (existing) {
      const sessionToken = issueSandboxSessionToken(ownerId);
      return c.json(
        {
          ok: true,
          containerId: existing.containerId,
          userId: ownerId,
          isAnonymous: true,
          anonId,
          idleTimeoutMin: ANON_IDLE_TIMEOUT_MIN,
          sessionToken,
          sessionTokenTtlSec: 5 * 60,
          wsPath: "/sandbox/ws",
          reused: true,
        },
        200,
      );
    }

    const info = await createContainer(ownerId);
    await startContainer(info.containerId);
    const sessionToken = issueSandboxSessionToken(ownerId);

    return c.json(
      {
        ok: true,
        containerId: info.containerId,
        userId: ownerId,
        isAnonymous: true,
        anonId,
        idleTimeoutMin: ANON_IDLE_TIMEOUT_MIN,
        sessionToken,
        sessionTokenTtlSec: 5 * 60,
        wsPath: "/sandbox/ws",
        reused: false,
      },
      201,
    );
  } catch (err) {
    if (err instanceof SandboxError) {
      const status =
        err.code === "FULL" || err.code === "TOO_MANY_PER_USER" || err.code === "ANON_FULL"
          ? 429
          : 500;
      return c.json({ error: err.message, code: err.code }, status);
    }
    console.error("[sandbox] anonymous-start falló:", err);
    return c.json({ error: "Error interno al crear sandbox anónimo" }, 500);
  }
});

// POST /sandbox/claim (logueado)
// Transfiere un container anónimo de la misma IP+UA al usuario actual.
// Si no hay container anónimo para reclamar, devuelve 200 con claimed:false
// (idempotente — el cliente puede llamarlo sin problema).
sandboxRoutes.post("/claim", async (c) => {
  const userId = await getUserIdFromCookie(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const anonId = deriveAnonId(c);

  try {
    const info = await claimAnonymousContainer(anonId, userId);
    if (!info) {
      return c.json({ ok: true, claimed: false });
    }
    // Emitir nuevo token con el userId real
    const sessionToken = issueSandboxSessionToken(userId);
    return c.json({
      ok: true,
      claimed: true,
      containerId: info.containerId,
      userId,
      idleTimeoutMin: IDLE_TIMEOUT_MIN,
      sessionToken,
      sessionTokenTtlSec: 5 * 60,
      wsPath: "/sandbox/ws",
    });
  } catch (err) {
    console.error("[sandbox] claim falló:", err);
    return c.json({ error: "Error interno al reclamar sandbox" }, 500);
  }
});

// POST /sandbox/stop
sandboxRoutes.post("/stop", async (c) => {
  const userId = await getUserIdFromCookie(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const active = getActiveForUser(userId);
  if (!active) return c.json({ error: "No hay sandbox activo" }, 404);

  try {
    await destroyContainer(active.containerId);
    return c.json({ ok: true });
  } catch (err) {
    console.error("[sandbox] stop falló:", err);
    return c.json({ error: "Error interno al detener sandbox" }, 500);
  }
});

// GET /sandbox/status
sandboxRoutes.get("/status", async (c) => {
  const userId = await getUserIdFromCookie(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const active = getActiveForUser(userId);
  if (!active) {
    return c.json({ ok: true, active: false, userId });
  }

  const ageMs = Date.now() - active.createdAt;
  const idleMs = Date.now() - active.lastActivityAt;

  return c.json({
    ok: true,
    active: true,
    userId,
    containerId: active.containerId,
    ageMs,
    idleMs,
    idleTimeoutMs: IDLE_TIMEOUT_MIN * 60 * 1000,
  });
});
