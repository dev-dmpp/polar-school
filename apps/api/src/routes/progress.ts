import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@polar-school/db";
import { lessonProgress } from "@polar-school/db";
import { lucia } from "../auth/lucia.js";

const markSchema = z.object({
  courseSlug: z.string().min(1).max(120),
  lessonSlug: z.string().min(1).max(120),
});

const unmarkSchema = markSchema;

async function requireUser(c: any): Promise<string | null> {
  const sessionId = lucia.readSessionCookie(c.req.header("cookie") ?? "");
  if (!sessionId) return null;
  const { session, user } = await lucia.validateSession(sessionId);
  if (!session || !user) return null;
  return user.id;
}

export const progressRoutes = new Hono();

// POST /progress — marca lección como completada (idempotente)
progressRoutes.post("/", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = markSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos inválidos" }, 400);
  }
  const { courseSlug, lessonSlug } = parsed.data;

  // UPSERT: insert o no-op si ya existe.
  const existing = await db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.courseSlug, courseSlug),
        eq(lessonProgress.lessonSlug, lessonSlug),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(lessonProgress).values({
      userId,
      courseSlug,
      lessonSlug,
    });
  } else {
    await db
      .update(lessonProgress)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(lessonProgress.userId, userId),
          eq(lessonProgress.courseSlug, courseSlug),
          eq(lessonProgress.lessonSlug, lessonSlug),
        ),
      );
  }
  return c.json({ ok: true });
});

// DELETE /progress — desmarca una lección
progressRoutes.delete("/", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "No autenticado" }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = unmarkSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);
  const { courseSlug, lessonSlug } = parsed.data;

  await db
    .delete(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.courseSlug, courseSlug),
        eq(lessonProgress.lessonSlug, lessonSlug),
      ),
    );
  return c.json({ ok: true });
});

// GET /progress — lista lecciones completadas del usuario
progressRoutes.get("/", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ lessons: [] });
  const rows = await db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, userId));
  return c.json({
    lessons: rows.map((r) => ({
      courseSlug: r.courseSlug,
      lessonSlug: r.lessonSlug,
      completedAt: r.completedAt.toISOString(),
    })),
  });
});
