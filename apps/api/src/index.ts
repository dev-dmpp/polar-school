import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.js";
import { progressRoutes } from "./routes/progress.js";
import { sandboxRoutes } from "./routes/sandbox.js";
import { attachSandboxWs } from "./sandbox/ws-route.js";
import { startCleanupLoop } from "./sandbox/cleanup.js";

const app = new Hono();

app.onError((err, c) => {
  console.error("🔥 API error:", err.message);
  console.error(err.stack);
  return c.json({ error: "Error interno del servidor" }, 500);
});

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (process.env.CORS_ORIGIN ?? "http://127.0.0.1:3000").split(","),
    credentials: true,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, service: "polar-school-api", time: new Date().toISOString() }),
);

app.route("/auth", authRoutes);
app.route("/progress", progressRoutes);
app.route("/sandbox", sandboxRoutes);

const port = Number(process.env.PORT ?? 3001);

if (import.meta.url === `file://${process.argv[1]}`) {
  // Log de la URL de DB parseada (sin password) para debug.
  const dbUrl =
    process.env.DATABASE_URL ??
    "postgres://polar:***@127.0.0.1:5433/polar_school";
  try {
    const u = new URL(dbUrl);
    console.log(
      `🔌 DB → ${u.protocol}//${u.username}@${u.hostname}:${u.port}${u.pathname}`,
    );
  } catch {
    console.log("🔌 DB → (URL inválida)");
  }

  // Creamos el server manualmente para tener acceso al objeto y montar el
  // upgrade de WebSocket del sandbox en el mismo puerto.
  const server = createServer(getRequestListener(app.fetch));

  server.listen(port, "127.0.0.1", () => {
    console.log(`🐻 Polar School API escuchando en http://127.0.0.1:${port}`);
  });

  // Montar WebSocket bridge del sandbox en /sandbox/ws
  attachSandboxWs(server);

  // Arrancar cleanup loop (mata sandboxes ociosos, huérfanos o que excedan MAX_TOTAL)
  startCleanupLoop();
}

export default app;
