import { Lucia, TimeSpan } from "lucia";
import { sqlClient } from "@polar-school/db";
import { CustomPostgresAdapter } from "./adapter.js";

const adapter = new CustomPostgresAdapter(sqlClient, {
  user: "users",
  session: "sessions",
});

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  sessionExpiresIn: new TimeSpan(30, "d"),
  getUserAttributes: (data) => ({
    email: data.email,
    emailVerified: data.email_verified,
    displayName: data.display_name,
  }),
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      email_verified: boolean;
      display_name: string | null;
    };
  }
}
