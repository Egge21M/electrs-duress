export { readConfigFromEnv } from "./src/config";
export { startFromEnv } from "./src/cli";
export { createDatabase, getDatabaseFileName } from "./src/db/client";
export {
  createXpubWatchSourceRepository,
  toWatchConfig,
} from "./src/db/xpub-watch-source-repository";
export { createXpubWatchService } from "./src/xpub-watch-service";
export { createElectrumProxy, formatUpstream } from "./src/proxy";
export type { ElectrsDatabase } from "./src/db/client";
export type {
  CreateXpubWatchSourceInput,
  UpdateXpubWatchSourceInput,
  XpubWatchSourceRepository,
} from "./src/db/xpub-watch-source-repository";
export type {
  NewXpubWatchSource,
  XpubWatchSource,
} from "./src/db/schema";
export type {
  ActiveWatchedAddress,
  XpubWatchService,
} from "./src/xpub-watch-service";
export type {
  CreateElectrumProxyOptions,
  ScriptHashWatchService,
} from "./src/proxy";
export {
  createConsoleNotificationHandler,
  createDefaultNotificationService,
  NotificationService,
} from "./src/notification-service";
export {
  createTelegramNotificationHandler,
  TelegramNotificationHandler,
} from "./src/telegram-notification-handler";
export { createXpubWatch } from "./src/xpub-watch";
export type {
  TelegramMessageSender,
  TelegramNotificationHandlerOptions,
} from "./src/telegram-notification-handler";
export type {
  Notification,
  NotificationHandler,
  WatchedScriptHashRequestedNotification,
} from "./src/notification-service";
export type {
  ElectrumProxyConfig,
  Endpoint,
  Logger,
  TelegramNotificationConfig,
  UpstreamEndpoint,
  WatchConfig,
} from "./src/types";

import { startFromEnv } from "./src/cli";

if (import.meta.main) {
  startFromEnv(Bun.env);
}
