import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://polar:polar_dev@127.0.0.1:5433/polar_school";

// Singleton: evitar múltiples pools en hot reload (dev).
const globalForDb = globalThis as unknown as {
  __polarDbClient?: ReturnType<typeof postgres>;
};

export const sqlClient: ReturnType<typeof postgres> =
  globalForDb.__polarDbClient ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__polarDbClient = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
export type Db = typeof db;
export { schema };
