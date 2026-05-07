import { expect, test } from "bun:test";
import { createDatabase } from "./client";
import { createConfigRepository } from "./config-repository";

test("sets, updates, lists, and deletes config entries", () => {
  const repository = createTestRepository();

  repository.set("LISTEN_PORT", "60001");
  repository.set("ELECTRUM_TLS", "true");
  expect(repository.get("LISTEN_PORT")).toBe("60001");

  repository.set("LISTEN_PORT", "61001");
  expect(repository.get("LISTEN_PORT")).toBe("61001");
  expect(repository.list()).toEqual({
    ELECTRUM_TLS: "true",
    LISTEN_PORT: "61001",
  });

  repository.delete("ELECTRUM_TLS");
  expect(repository.get("ELECTRUM_TLS")).toBeUndefined();
  expect(repository.list()).toEqual({
    LISTEN_PORT: "61001",
  });
});

function createTestRepository() {
  const db = createDatabase(":memory:");

  db.$client.run(`
    CREATE TABLE config_entries (
      key text PRIMARY KEY NOT NULL,
      value text NOT NULL,
      updated_at_ms integer NOT NULL
    )
  `);

  return createConfigRepository(db);
}
