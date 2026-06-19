import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.js";
import { progressRoutes } from "./routes/progress.js";

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

const port = Number(process.env.PORT ?? 3001);

if (import.meta.url === `file://${process.argv[1]}`) {
  // Log de la URL de DB parseada (sin password) para debug.
  const dbUrl =
    process.env.DATABASE_URL ??
    "postgres://polar:polar_dev@127.0.0.1:5433/polar_school";
  try {
    const u = new URL(dbUrl);
    console.log(
      `🔌 DB → ${u.protocol}//${u.username}@${u.hostname}:${u.port}${u.pathname}`,
    );
  } catch {
    console.log("🔌 DB → (URL inválida)");
  }
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
    console.log(`🐻 Polar School API escuchando en http://127.0.0.1:${info.port}`);
  });
}

export default app;
