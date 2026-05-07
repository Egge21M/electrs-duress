import { eq } from "drizzle-orm";
import type { WatchConfig } from "../types";
import type { ElectrsDatabase } from "./client";
import { xpubWatchSources, type XpubWatchSource } from "./schema";

export interface CreateXpubWatchSourceInput extends WatchConfig {
  label?: string;
}

export interface UpdateXpubWatchSourceInput {
  addressCount?: number;
  label?: string | null;
}

export interface XpubWatchSourceRepository {
  add(input: CreateXpubWatchSourceInput): XpubWatchSource;
  delete(xpub: string): void;
  disable(xpub: string): XpubWatchSource;
  enable(xpub: string): XpubWatchSource;
  get(xpub: string): XpubWatchSource | undefined;
  list(): XpubWatchSource[];
  listEnabled(): XpubWatchSource[];
  update(xpub: string, input: UpdateXpubWatchSourceInput): XpubWatchSource;
}

export function createXpubWatchSourceRepository(
  db: ElectrsDatabase,
): XpubWatchSourceRepository {
  return {
    add(input) {
      const now = Date.now();

      return db
        .insert(xpubWatchSources)
        .values({
          label: input.label ?? null,
          xpub: input.xpub,
          addressCount: input.addressCount,
          enabled: true,
          createdAtMs: now,
          updatedAtMs: now,
        })
        .onConflictDoUpdate({
          target: xpubWatchSources.xpub,
          set: {
            label: input.label ?? null,
            addressCount: input.addressCount,
            enabled: true,
            updatedAtMs: now,
          },
        })
        .returning()
        .get();
    },

    delete(xpub) {
      db.delete(xpubWatchSources).where(eq(xpubWatchSources.xpub, xpub)).run();
    },

    disable(xpub) {
      return updateExisting(db, xpub, {
        enabled: false,
        updatedAtMs: Date.now(),
      });
    },

    enable(xpub) {
      return updateExisting(db, xpub, {
        enabled: true,
        updatedAtMs: Date.now(),
      });
    },

    get(xpub) {
      return db
        .select()
        .from(xpubWatchSources)
        .where(eq(xpubWatchSources.xpub, xpub))
        .get();
    },

    list() {
      return db.select().from(xpubWatchSources).all();
    },

    listEnabled() {
      return db
        .select()
        .from(xpubWatchSources)
        .where(eq(xpubWatchSources.enabled, true))
        .all();
    },

    update(xpub, input) {
      const nextValues: UpdateXpubWatchSourceInput & { updatedAtMs: number } = {
        ...input,
        updatedAtMs: Date.now(),
      };

      if (input.label === null) {
        nextValues.label = null;
      }

      return updateExisting(db, xpub, nextValues);
    },
  };
}

export function toWatchConfig(source: XpubWatchSource): WatchConfig {
  return {
    xpub: source.xpub,
    addressCount: source.addressCount,
  };
}

function updateExisting(
  db: ElectrsDatabase,
  xpub: string,
  values: Partial<XpubWatchSource>,
) {
  const updated = db
    .update(xpubWatchSources)
    .set(values)
    .where(eq(xpubWatchSources.xpub, xpub))
    .returning()
    .get();

  if (!updated) {
    throw new Error("Xpub watch source does not exist");
  }

  return updated;
}
