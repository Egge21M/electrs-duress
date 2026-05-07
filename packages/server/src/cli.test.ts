import { randomUUID } from "node:crypto";
import { Server } from "node:net";
import { expect, test } from "bun:test";
import { startFromEnv } from "./cli";
import { createDatabase } from "./db/client";

test("starts after xpub watch source migrations have been applied", async () => {
  const dbFileName = `/tmp/electrs-duress-cli-${randomUUID()}.sqlite`;
  const db = createDatabase(dbFileName);
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
  db.$client.close();

  const port = await getAvailablePort();
  const server = startFromEnv({
    DB_FILE_NAME: dbFileName,
    LISTEN_PORT: String(port),
  });

  await waitForListening(server);
  await closeServer(server);
});

test("fails clearly when the xpub watch source table is missing", () => {
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
