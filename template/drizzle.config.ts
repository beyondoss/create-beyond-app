import { defineConfig } from "drizzle-kit";

// Migrations are generated locally with `npm run db:generate` and applied during
// the build (`npm run db:migrate`), which the Beyond repo agent runs in the build
// phase. Forks inherit the already-migrated schema via the copy-on-write volume.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/postgres",
  },
});
