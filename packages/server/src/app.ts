import type { Server } from "node:net";
import { readConfig } from "./config";
import {
  createDatabase,
  getDatabaseFileName,
  type ElectrsDatabase,
} from "./db/client";
import {
  createConfigRepository,
  type ConfigRepository,
} from "./db/config-repository";
import {
  createXpubWatchSourceRepository,
  type XpubWatchSourceRepository,
} from "./db/xpub-watch-source-repository";
import {
  createDefaultNotificationService,
  type NotificationService,
} from "./notification-service";
import { createElectrumProxy } from "./proxy";
import { createTelegramNotificationHandler } from "./telegram-notification-handler";
import type { ElectrumProxyConfig, Logger } from "./types";
import {
  createXpubWatchService,
  type XpubWatchService,
} from "./xpub-watch-service";

export interface ElectrsDuressRuntime {
  close(): Promise<void>;
  config: ElectrumProxyConfig;
  configRepository: ConfigRepository;
  database: ElectrsDatabase;
  notificationService: NotificationService;
  server: Server;
  watchSourceRepository: XpubWatchSourceRepository;
  watchService: XpubWatchService;
}

export interface CreateElectrsDuressRuntimeOptions {
  dbFileName?: string;
  env?: Record<string, string | undefined>;
  logger?: Logger;
}

export function createElectrsDuressRuntime(
  options: CreateElectrsDuressRuntimeOptions = {},
): ElectrsDuressRuntime {
  const logger = options.logger ?? console;
  const database = createDatabase(
    options.dbFileName ?? getDatabaseFileName(options.env ?? Bun.env),
  );

  try {
    const configRepository = createConfigRepository(database);
    const config = readConfig(configRepository.list());
    const notificationService = createRuntimeNotificationService(config, logger);
    const watchSourceRepository = createXpubWatchSourceRepository(database);
    const watchService = createXpubWatchService(watchSourceRepository);
    watchService.init();

    const server = createElectrumProxy({
      config,
      logger,
      notificationService,
      watchService,
    });
    const closeDatabase = createOnce(() => database.$client.close());

    server.on("close", () => {
      closeDatabase();
    });

    return {
      close: () => closeRuntime(server, closeDatabase),
      config,
      configRepository,
      database,
      notificationService,
      server,
      watchSourceRepository,
      watchService,
    };
  } catch (error) {
    database.$client.close();
    throw createDatabaseStartupError(error);
  }
}

export function createRuntimeNotificationService(
  config: ElectrumProxyConfig,
  logger: Logger,
) {
  const notificationService = createDefaultNotificationService(logger);

  if (config.telegram) {
    notificationService.register(
      createTelegramNotificationHandler(config.telegram, logger),
    );
  }

  return notificationService;
}

export function createDatabaseStartupError(error: unknown) {
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

function closeRuntime(server: Server, closeDatabase: () => void) {
  return new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      closeDatabase();
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function createOnce(callback: () => void) {
  let called = false;

  return () => {
    if (called) {
      return;
    }

    called = true;
    callback();
  };
}
