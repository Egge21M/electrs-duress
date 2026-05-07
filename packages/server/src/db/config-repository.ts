import { eq } from "drizzle-orm";
import type { ElectrsDatabase } from "./client";
import { configEntries } from "./schema";

export interface ConfigRepository {
  delete(key: string): void;
  get(key: string): string | undefined;
  list(): Record<string, string>;
  set(key: string, value: string): void;
}

export function createConfigRepository(db: ElectrsDatabase): ConfigRepository {
  return {
    delete(key) {
      db.delete(configEntries).where(eq(configEntries.key, key)).run();
    },

    get(key) {
      return db
        .select({ value: configEntries.value })
        .from(configEntries)
        .where(eq(configEntries.key, key))
        .get()?.value;
    },

    list() {
      return Object.fromEntries(
        db.select().from(configEntries).all().map((entry) => [
          entry.key,
          entry.value,
        ]),
      );
    },

    set(key, value) {
      const now = Date.now();

      db.insert(configEntries)
        .values({
          key,
          value,
          updatedAtMs: now,
        })
        .onConflictDoUpdate({
          target: configEntries.key,
          set: {
            value,
            updatedAtMs: now,
          },
        })
        .run();
    },
  };
}
