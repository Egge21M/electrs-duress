import { defineConfig } from "drizzle-kit";

const dbFileName = process.env.DB_FILE_NAME ?? "electrs-duress.sqlite";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbFileName,
  },
});
