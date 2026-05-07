import { expect, test } from "bun:test";
import { createXpubWatchSourceRepository } from "./db/xpub-watch-source-repository";
import { createDatabase } from "./db/client";
import type { XpubWatchSource } from "./db/schema";
import { createXpubWatchService } from "./xpub-watch-service";
import type { XpubWatch } from "./xpub-watch";

const sampleXpub =
  "xpub6DDeqdmzCpioRhR7fgHQAibbTMNRcPnW1qcYrrtAR5YEAWztVK3G6HuAky6Y3mZzB4UCqVifkXFY2qBUv8rJCHiT1JfoCLtUerZYp653yss";
const secondXpub =
  "xpub661MyMwAqRbcFtXgS5sYJABQQgpx5m4yq9jBLV6Uq2bctuGepvr4LB7s4LYxrbe3kN1Yt8vvDJWs6GSVjtKwA6p5H7nNsYfAZK1BL3hEzVJ";
const watchedScriptHash =
  "aa7ea9c5470f1a8186bfcac43af945464514633106097c14b8375bfcba7ef21f";

test("initializes active watches from enabled repository sources", () => {
  const { repository } = createTestRepository();
  repository.add({
    label: "receive wallet",
    xpub: sampleXpub,
    addressCount: 1,
  });
  repository.add({
    xpub: secondXpub,
    addressCount: 1,
  });
  repository.disable(secondXpub);

  const service = createXpubWatchService(repository);
  service.init();

  expect(service.listActiveSources().map((source) => source.xpub)).toEqual([
    sampleXpub,
  ]);
  expect(service.matchScriptHash(watchedScriptHash)).toEqual([
    {
      address: "1Exq3M51dXqk8eHnosigC5DPDVYbxz9934",
      index: 0,
      path: "m/0/0",
      scriptHash: watchedScriptHash,
      sourceLabel: "receive wallet",
    },
  ]);
});

test("adds, disables, enables, and deletes active watches", () => {
  const { repository } = createTestRepository();
  const service = createXpubWatchService(repository);
  service.init();

  service.add({
    xpub: sampleXpub,
    addressCount: 1,
  });
  expect(service.matchScriptHash(watchedScriptHash)).toHaveLength(1);

  service.disable(sampleXpub);
  expect(repository.get(sampleXpub)?.enabled).toBe(false);
  expect(service.matchScriptHash(watchedScriptHash)).toEqual([]);

  service.enable(sampleXpub);
  expect(repository.get(sampleXpub)?.enabled).toBe(true);
  expect(service.matchScriptHash(watchedScriptHash)).toHaveLength(1);

  service.delete(sampleXpub);
  expect(repository.get(sampleXpub)).toBeUndefined();
  expect(service.matchScriptHash(watchedScriptHash)).toEqual([]);
});

test("keeps all overlapping script-hash matches in memory", () => {
  const { repository } = createTestRepository();
  repository.add({
    label: "first",
    xpub: sampleXpub,
    addressCount: 1,
  });
  repository.add({
    label: "second",
    xpub: secondXpub,
    addressCount: 1,
  });

  const service = createXpubWatchService(repository, {
    deriveWatch: (source) => createFakeWatch(source),
  });
  service.init();

  expect(
    service.matchScriptHash(watchedScriptHash).map((match) => match.sourceLabel),
  ).toEqual(["first", "second"]);
});

function createTestRepository() {
  const db = createDatabase(":memory:");

  db.$client.run(`
    CREATE TABLE xpub_watch_sources (
      xpub text PRIMARY KEY NOT NULL,
      label text,
      address_count integer NOT NULL,
      enabled integer NOT NULL,
      created_at_ms integer NOT NULL,
      updated_at_ms integer NOT NULL
    )
  `);

  return {
    db,
    repository: createXpubWatchSourceRepository(db),
  };
}

function createFakeWatch(source: XpubWatchSource): XpubWatch {
  const address = {
    address: `address-${source.label}`,
    index: 0,
    path: "m/0/0",
    scriptHash: watchedScriptHash,
  };

  return {
    addresses: [address],
    byScriptHash: new Map([[watchedScriptHash, address]]),
  };
}
