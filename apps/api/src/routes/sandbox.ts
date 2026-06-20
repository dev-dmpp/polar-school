import { Hono } from "hono";
import { lucia } from "../auth/lucia.js";
import {
  createContainer,
  destroyContainer,
  getActiveForUser,
  startContainer,
  SandboxError,
} from "../sandbox/manager.js";
import { IDLE_TIMEOUT_MIN } from "../sandbox/limits.js";
import { issueSandboxSessionToken } from "../sandbox/session-token.js";

/**
 * Rutas REST para gestionar el sandbox del usuario.
 * El WebSocket bridge (Iter 3) vive en otra ruta.
 *
 * Endpoints:
 *   POST /sandbox/start   → crea + inicia contenedor
 *   POST /sandbox/stop    → mata contenedor
 *   GET  /sandbox/status  → estado actual
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

// POST /sandbox/start
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
