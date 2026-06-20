import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres@localhost:5432/postgres";

// Beyond serves Postgres through PgBouncer in transaction pooling mode, which is
// incompatible with prepared statements — disable them on the driver.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
