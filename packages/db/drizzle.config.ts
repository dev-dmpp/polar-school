import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ?? "postgres://polar:polar_dev@127.0.0.1:5433/polar_school";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
