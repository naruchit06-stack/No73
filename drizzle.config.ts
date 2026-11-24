import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// Cloud MySQL needs TLS: DATABASE_SSL=true switches to explicit credentials with SSL.
const u = new URL(connectionString);
const dbCredentials =
  process.env.DATABASE_SSL === "true"
    ? {
        host: u.hostname,
        port: Number(u.port) || 3306,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, ""),
        ssl: { rejectUnauthorized: true },
      }
    : { url: connectionString };

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials,
});
