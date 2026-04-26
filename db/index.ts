import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.ts";
import ENV from './env.ts';

const { Pool } = pg;

if (!ENV.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: ENV.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema/index.ts";
