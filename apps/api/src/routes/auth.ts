import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@polar-school/db";
import { users, userPasswords } from "@polar-school/db";
import { lucia } from "../auth/lucia.js";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { issueMagicLink, consumeMagicLink } from "../auth/magic-link.js";

const registerSchema = z.object({
  email: z.string().email().max(255).transform((s) => s.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(60).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255).transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1).max(128),
});

const magicLinkRequestSchema = z.object({
  email: z.string().email().max(255).transform((s) => s.toLowerCase().trim()),
});

export const authRoutes = new Hono();

// POST /auth/register
authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos inválidos", issues: parsed.error.issues }, 400);
  }
  const { email, password, displayName } = parsed.data;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Este correo ya está registrado" }, 409);
  }

  const userId = randomBytes(16).toString("hex");
  await db.insert(users).values({
    id: userId,
    email,
    emailVerified: false,
    displayName: displayName ?? null,
  });
  await db.insert(userPasswords).values({
    userId,
    hash: hashPassword(password),
  });

  const session = await lucia.createSession(userId, { fresh: true });
  const cookie = lucia.createSessionCookie(session.id);
  c.header("Set-Cookie", cookie.serialize(), { append: true });
  return c.json({ ok: true, userId });
});

// POST /auth/login
authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos inválidos", issues: parsed.error.issues }, 400);
  }
  const { email, password } = parsed.data;

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return c.json({ error: "Correo o contraseña incorrectos" }, 401);
  }
  const pwRows = await db
    .select()
    .from(userPasswords)
    .where(eq(userPasswords.userId, user.id))
    .limit(1);
  const stored = pwRows[0];
  if (!stored) {
    return c.json(
      { error: "Esta cuenta no usa contraseña. Solicita un magic link." },
      401,
    );
  }
  if (!verifyPassword(password, stored.hash)) {
    return c.json({ error: "Correo o contraseña incorrectos" }, 401);
  }

  const session = await lucia.createSession(user.id, { fresh: true });
  const cookie = lucia.createSessionCookie(session.id);
  c.header("Set-Cookie", cookie.serialize(), { append: true });
  return c.json({ ok: true });
});

// POST /auth/logout
authRoutes.post("/logout", async (c) => {
  const sessionId = lucia.readSessionCookie(c.req.header("cookie") ?? "");
  if (sessionId) {
    await lucia.invalidateSession(sessionId);
    const cookie = lucia.createBlankSessionCookie();
    c.header("Set-Cookie", cookie.serialize(), { append: true });
  }
  return c.json({ ok: true });
});

// POST /auth/magic-link
// Crea el usuario si no existe, luego emite un magic link.
// (Magic link es auto-registro en este proyecto: la primera vez que
// alguien pide un enlace, se crea la cuenta.)
authRoutes.post("/magic-link", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = magicLinkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Correo inválido" }, 400);
  }
  const { email } = parsed.data;

  let userRows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  let user = userRows[0];
  if (!user) {
    const userId = randomBytes(16).toString("hex");
    await db.insert(users).values({ id: userId, email });
    userRows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    user = userRows[0];
  }

  await issueMagicLink({ userId: user!.id, email });
  return c.json({ ok: true });
});

// GET /auth/callback?token=...
// Valida el magic link, crea sesión, redirige al home.
// (Esta ruta la consume el navegador, no fetch JS.)
authRoutes.get("/callback", async (c) => {
  const token = c.req.query("token");
  const userId = await consumeMagicLink(token ?? "");
  if (!userId) {
    return c.text("Enlace inválido o expirado", 400);
  }
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, userId));
  const session = await lucia.createSession(userId, { fresh: true });
  const cookie = lucia.createSessionCookie(session.id);
  c.header("Set-Cookie", cookie.serialize(), { append: true });
  return c.redirect("/", 302);
});

// GET /auth/me
// Devuelve el usuario actual o null.
authRoutes.get("/me", async (c) => {
  const sessionId = lucia.readSessionCookie(c.req.header("cookie") ?? "");
  if (!sessionId) return c.json({ user: null });
  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    const cookie = lucia.createSessionCookie(session.id);
    c.header("Set-Cookie", cookie.serialize(), { append: true });
  }
  if (!session) {
    const cookie = lucia.createBlankSessionCookie();
    c.header("Set-Cookie", cookie.serialize(), { append: true });
    return c.json({ user: null });
  }
  return c.json({
    user: {
      id: user.id,
      email: (user as any).email,
      emailVerified: (user as any).emailVerified,
      displayName: (user as any).displayName,
    },
  });
});
