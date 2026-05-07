import { expect, test } from "bun:test";
import {
  createXpubWatchSourceRepository,
  toWatchConfig,
} from "./xpub-watch-source-repository";
import { createDatabase } from "./client";

const sampleXpub =
  "xpub661MyMwAqRbcFtXgS5sYJABQQgpx5m4yq9jBLV6Uq2bctuGepvr4LB7s4LYxrbe3kN1Yt8vvDJWs6GSVjtKwA6p5H7nNsYfAZK1BL3hEzVJ";

test("creates and reads xpub watch sources", () => {
  const repository = createTestRepository();

  const source = repository.add({
    label: "main wallet",
    xpub: sampleXpub,
    addressCount: 200,
  });

  expect(source).toMatchObject({
    label: "main wallet",
    xpub: sampleXpub,
    addressCount: 200,
    enabled: true,
  });
  expect(repository.get(sampleXpub)).toEqual(source);
  expect(repository.list()).toEqual([source]);
  expect(repository.listEnabled()).toEqual([source]);
});

test("adds existing xpub watch sources by updating and enabling them", () => {
  const repository = createTestRepository();
  repository.add({
    xpub: sampleXpub,
    addressCount: 200,
  });
  repository.disable(sampleXpub);

  const source = repository.add({
    label: "main wallet",
    xpub: sampleXpub,
    addressCount: 500,
  });

  expect(source).toMatchObject({
    label: "main wallet",
    xpub: sampleXpub,
    addressCount: 500,
    enabled: true,
  });
  expect(repository.list()).toHaveLength(1);
});

test("updates and disables xpub watch sources", () => {
  const repository = createTestRepository();
  const source = repository.add({
    xpub: sampleXpub,
    addressCount: 200,
  });

  const updated = repository.update(source.xpub, {
    addressCount: 500,
    label: "expanded wallet",
  });

  expect(updated).toMatchObject({
    xpub: source.xpub,
    addressCount: 500,
    enabled: true,
    label: "expanded wallet",
  });

  const disabled = repository.disable(source.xpub);
  expect(disabled.enabled).toBe(false);
  expect(repository.listEnabled()).toEqual([]);

  const enabled = repository.enable(source.xpub);
  expect(enabled.enabled).toBe(true);

  const withoutLabel = repository.update(source.xpub, {
    label: null,
  });

  expect(withoutLabel.label).toBeNull();
});

test("deletes xpub watch sources", () => {
  const repository = createTestRepository();
  const source = repository.add({
    xpub: sampleXpub,
    addressCount: 200,
  });

  repository.delete(source.xpub);

  expect(repository.get(source.xpub)).toBeUndefined();
  expect(repository.list()).toEqual([]);
});

test("converts xpub watch source rows to watch config", () => {
  const repository = createTestRepository();
  const source = repository.add({
    xpub: sampleXpub,
    addressCount: 50,
  });

  expect(toWatchConfig(source)).toEqual({
    xpub: sampleXpub,
    addressCount: 50,
  });
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

  return createXpubWatchSourceRepository(db);
}
