import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createDatabase, getDatabaseFileName } from "./client";

const dbFileName = getDatabaseFileName(Bun.env);
const db = createDatabase(dbFileName);

migrate(db, {
  migrationsFolder: new URL("../../drizzle", import.meta.url).pathname,
});

db.$client.close();
console.log(`Applied migrations to ${dbFileName}`);
