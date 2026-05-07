import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Database } from "bun:sqlite";
import * as schema from "./schema";

export type ElectrsDatabase = BunSQLiteDatabase<typeof schema> & {
  $client: Database;
};

export function createDatabase(
  fileName = getDatabaseFileName(Bun.env),
): ElectrsDatabase {
  return drizzle(fileName, { schema });
}

export function getDatabaseFileName(env: Record<string, string | undefined>) {
  return env.DB_FILE_NAME || "electrs-duress.sqlite";
}
