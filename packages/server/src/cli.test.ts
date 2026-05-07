import { randomUUID } from "node:crypto";
import { Server } from "node:net";
import { expect, test } from "bun:test";
import { startFromEnv } from "./cli";
import { createDatabase } from "./db/client";

test("starts with config loaded from sqlite", async () => {
  const dbFileName = `/tmp/electrs-duress-cli-${randomUUID()}.sqlite`;
  const db = createDatabase(dbFileName);
  const port = await getAvailablePort();

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
    ["LISTEN_PORT", String(port), Date.now()],
  );
  db.$client.close();

  const server = startFromEnv({
    DB_FILE_NAME: dbFileName,
  });

  await waitForListening(server);
  await closeServer(server);
});

test("fails clearly when sqlite config tables are missing", () => {
  expect(() =>
    startFromEnv({
      DB_FILE_NAME: ":memory:",
    }),
  ).toThrow(
    "SQLite database is not migrated; run `bun run db:migrate` before starting electrs-duress",
  );
});

function waitForListening(server: Server) {
  return new Promise<void>((resolve, reject) => {
    if (server.listening) {
      resolve();
      return;
    }

    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function getAvailablePort() {
  const server = new Server();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Server did not bind to a TCP port");
  }

  await closeServer(server);
  return address.port;
}
