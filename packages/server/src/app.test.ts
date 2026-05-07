import { randomUUID } from "node:crypto";
import { expect, test } from "bun:test";
import {
  createDatabaseStartupError,
  createElectrsDuressRuntime,
  createRuntimeNotificationService,
} from "./app";
import { createDatabase } from "./db/client";

test("composes runtime services from a migrated sqlite database", async () => {
  const dbFileName = createMigratedDatabase();
  const logs: string[] = [];
  const runtime = createElectrsDuressRuntime({
    dbFileName,
    logger: {
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    },
  });

  expect(runtime.config.listen.port).toBe(61001);
  expect(runtime.watchService.listActiveSources()).toEqual([]);

  await runtime.close();
});

test("creates a default notification service without coupling it to the proxy", async () => {
  const logs: string[] = [];
  const notificationService = createRuntimeNotificationService(
    {
      listen: {
        host: "127.0.0.1",
        port: 60001,
      },
      upstream: {
        host: "127.0.0.1",
        port: 50001,
        tls: false,
        tlsRejectUnauthorized: true,
      },
      logAddressRequests: false,
    },
    {
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    },
  );

  await notificationService.notify({
    type: "watched-scripthash-requested",
    clientLabel: "127.0.0.1:12345",
    id: 1,
    method: "blockchain.scripthash.get_balance",
    scriptHash: "hash",
    watchedAddress: {
      address: "address",
      index: 0,
      path: "m/0/0",
      scriptHash: "hash",
    },
  });

  expect(logs).toEqual([
    "[alert] watched script-hash requested client=127.0.0.1:12345 method=blockchain.scripthash.get_balance address=address path=m/0/0 scripthash=hash id=1",
  ]);
});

test("wraps missing sqlite table errors with migration guidance", () => {
  const cause = new Error("no such table: config_entries");
  const wrapped = createDatabaseStartupError(cause);

  expect(wrapped).toBeInstanceOf(Error);
  expect((wrapped as Error).message).toBe(
    "SQLite database is not migrated; run `bun run db:migrate` before starting electrs-duress",
  );
  expect((wrapped as Error).cause).toBe(cause);
});

function createMigratedDatabase() {
  const dbFileName = `/tmp/electrs-duress-app-${randomUUID()}.sqlite`;
  const db = createDatabase(dbFileName);

  db.$client.run(`
    CREATE TABLE config_entries (
      key text PRIMARY KEY NOT NULL,
      value text NOT NULL,
      updated_at_ms integer NOT NULL
    )
  `);
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
  db.$client.run(
    `INSERT INTO config_entries (key, value, updated_at_ms) VALUES (?, ?, ?)`,
    ["LISTEN_PORT", "61001", Date.now()],
  );
  db.$client.close();

  return dbFileName;
}
