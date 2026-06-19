import {
  pgTable,
  text,
  timestamp,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// Users
// ============================================================
// Un usuario puede autenticarse con:
//   - email + password (tabla `user_passwords`)
//   - magic link por email (tabla `magic_link_tokens`)
// El campo `email_verified` se setea a true cuando el usuario
// confirma su correo (ya sea registrando password o usando magic link).
// `display_name` se muestra en /cuenta. Es opcional.
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

// ============================================================
// User passwords (opcional, Lucia v3 no lo exige)
// ============================================================
// Hash bcrypt. Separado de la tabla users para que un usuario
// pueda existir sin password (caso magic link puro) o tener ambos.
export const userPasswords = pgTable("user_passwords", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// Sessions (Lucia v3)
// ============================================================
// Lucia v3 usa sesiones opacas. El cookie lleva el session id
// y la DB valida. `fresh` indica si la sesión fue renovada en
// este request (Lucia maneja la rotación).
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  fresh: boolean("fresh").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// Magic link tokens
// ============================================================
// Token aleatorio de 32 bytes hex. TTL corto (15 min).
// `consumedAt` se setea cuando se usa (one-time use).
// Se indexa por token para lookup rápido al consumir.
export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenHashIdx: index("magic_link_tokens_hash_idx").on(t.tokenHash),
    userIdIdx: index("magic_link_tokens_user_idx").on(t.userId),
  }),
);

// ============================================================
// Lesson progress
// ============================================================
// Composite primary key (user_id, course_slug, lesson_slug)
// para que un usuario no pueda tener duplicados. `completedAt`
// se setea la primera vez que marca la lección. `updatedAt`
// se actualiza en cada mark (para futuras estadísticas).
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseSlug: text("course_slug").notNull(),
    lessonSlug: text("lesson_slug").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.courseSlug, t.lessonSlug] }),
    userIdx: index("lesson_progress_user_idx").on(t.userId),
  }),
);

// ============================================================
// Relations (para query builder tipado)
// ============================================================
export const usersRelations = relations(users, ({ one, many }) => ({
  password: one(userPasswords, {
    fields: [users.id],
    references: [userPasswords.userId],
  }),
  sessions: many(sessions),
  magicLinks: many(magicLinkTokens),
  progress: many(lessonProgress),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const magicLinkTokensRelations = relations(
  magicLinkTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [magicLinkTokens.userId],
      references: [users.id],
    }),
  }),
);

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, {
    fields: [lessonProgress.userId],
    references: [users.id],
  }),
}));

// Tipos inferidos para usar en el resto del monorepo
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type LessonProgressRow = typeof lessonProgress.$inferSelect;
export type NewLessonProgress = typeof lessonProgress.$inferInsert;
