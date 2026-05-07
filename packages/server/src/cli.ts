import { readConfigFromEnv } from "./config";
import { createDatabase, getDatabaseFileName } from "./db/client";
import { createConfigRepository } from "./db/config-repository";
import { createXpubWatchSourceRepository } from "./db/xpub-watch-source-repository";
import { createElectrumProxy, formatUpstream } from "./proxy";
import { createXpubWatchService } from "./xpub-watch-service";

export function startFromEnv(env: Record<string, string | undefined>) {
  const db = createDatabase(getDatabaseFileName(env));

  try {
    const config = readConfigFromEnv(createConfigRepository(db).list());
    const watchService = createXpubWatchService(
      createXpubWatchSourceRepository(db),
    );
    watchService.init();

    const server = createElectrumProxy({ config, watchService });

    server.on("error", () => {
      process.exitCode = 1;
    });

    server.on("close", () => {
      db.$client.close();
    });

    server.listen(config.listen.port, config.listen.host, () => {
      console.log(
        `electrs-duress listening on ${config.listen.host}:${config.listen.port}, forwarding to ${formatUpstream(
          config.upstream,
        )}`,
      );
    });

    return server;
  } catch (error) {
    db.$client.close();
    throw createDatabaseStartupError(error);
  }
}

function createDatabaseStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("config_entries") ||
    message.includes("xpub_watch_sources")
  ) {
    return new Error(
      "SQLite database is not migrated; run `bun run db:migrate` before starting electrs-duress",
      { cause: error },
    );
  }

  return error;
}
