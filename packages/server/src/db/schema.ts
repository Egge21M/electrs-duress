import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const xpubWatchSources = sqliteTable("xpub_watch_sources", {
  xpub: text("xpub").primaryKey(),
  label: text("label"),
  addressCount: integer("address_count").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  createdAtMs: integer("created_at_ms").notNull(),
  updatedAtMs: integer("updated_at_ms").notNull(),
});

export type XpubWatchSource = typeof xpubWatchSources.$inferSelect;
export type NewXpubWatchSource = typeof xpubWatchSources.$inferInsert;
