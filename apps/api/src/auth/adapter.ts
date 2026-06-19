// Adapter Lucia v3 para postgres.js.
//
// Lucia v3 requiere Adapter con cuatro métodos:
//   - deleteSession
//   - deleteUserSessions
//   - getSessionAndUser
//   - getUserSessions
//   - setSession
//   - updateSessionExpiration
//   - deleteExpiredSessions
//
// El adapter oficial (@lucia-auth/adapter-postgresql) pasa Date objects
// al cliente postgres.js, que las rechaza. Aquí serializo a ISO string.

import type {
  Adapter,
  DatabaseSession,
  DatabaseUser,
} from "lucia";
import type { Sql } from "postgres";

export class CustomPostgresAdapter implements Adapter {
  private sql: Sql;
  private userTable: string;
  private sessionTable: string;

  constructor(sql: Sql, tableNames: { user: string; session: string }) {
    this.sql = sql;
    this.userTable = tableNames.user;
    this.sessionTable = tableNames.session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sql`DELETE FROM ${this.sql(this.sessionTable)} WHERE id = ${sessionId}`;
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.sql`DELETE FROM ${this.sql(this.sessionTable)} WHERE user_id = ${userId}`;
  }

  async getSessionAndUser(
    sessionId: string,
  ): Promise<[DatabaseSession | null, DatabaseUser | null]> {
    const rows = await this.sql<
      Array<{
        session_id: string;
        session_user_id: string;
        session_expires_at: Date | string;
        user_id: string;
        email: string;
        email_verified: boolean;
        display_name: string | null;
      }>
    >`
      SELECT
        s.id AS session_id,
        s.user_id AS session_user_id,
        s.expires_at AS session_expires_at,
        u.id AS user_id,
        u.email,
        u.email_verified,
        u.display_name
      FROM ${this.sql(this.sessionTable)} s
      INNER JOIN ${this.sql(this.userTable)} u ON u.id = s.user_id
      WHERE s.id = ${sessionId}
    `;
    const row = rows[0];
    if (!row) return [null, null];
    const expiresAt =
      row.session_expires_at instanceof Date
        ? row.session_expires_at
        : new Date(row.session_expires_at);
    const session: DatabaseSession = {
      id: row.session_id,
      userId: row.session_user_id,
      expiresAt,
      attributes: {},
    };
    const user: DatabaseUser = {
      id: row.user_id,
      attributes: {
        email: row.email,
        email_verified: row.email_verified,
        display_name: row.display_name,
      },
    };
    return [session, user];
  }

  async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    const rows = await this.sql<
      Array<{ id: string; user_id: string; expires_at: Date | string }>
    >`SELECT id, user_id, expires_at FROM ${this.sql(this.sessionTable)} WHERE user_id = ${userId}`;
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      expiresAt:
        r.expires_at instanceof Date ? r.expires_at : new Date(r.expires_at),
      attributes: {},
    }));
  }

  async setSession(session: DatabaseSession): Promise<void> {
    await this.sql`
      INSERT INTO ${this.sql(this.sessionTable)}
        (id, user_id, expires_at)
      VALUES
        (${session.id}, ${session.userId}, ${session.expiresAt.toISOString()})
    `;
  }

  async updateSessionExpiration(
    sessionId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.sql`
      UPDATE ${this.sql(this.sessionTable)}
      SET expires_at = ${expiresAt.toISOString()}
      WHERE id = ${sessionId}
    `;
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.sql`DELETE FROM ${this.sql(this.sessionTable)} WHERE expires_at <= NOW()`;
  }
}
