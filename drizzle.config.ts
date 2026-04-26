import { defineConfig } from "drizzle-kit";
import ENV from "./db/env.ts";

if (!ENV.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.DATABASE_URL,
  },
});