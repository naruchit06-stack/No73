import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    // Cloud MySQL (TiDB Cloud, Aiven, PlanetScale, ...) requires TLS: set DATABASE_SSL=true.
    const connection = env.databaseSsl
      ? mysql.createPool({
          uri: env.databaseUrl,
          ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
          connectionLimit: 10,
        })
      : env.databaseUrl;
    instance = drizzle(connection as string, {
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}
