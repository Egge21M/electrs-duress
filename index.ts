export { readConfigFromEnv } from "./src/config";
export { startFromEnv } from "./src/cli";
export { createElectrumProxy, formatUpstream } from "./src/proxy";
export type { CreateElectrumProxyOptions } from "./src/proxy";
export {
  createConsoleNotificationHandler,
  createDefaultNotificationService,
  NotificationService,
} from "./src/notification-service";
export { createXpubWatch } from "./src/xpub-watch";
export type {
  Notification,
  NotificationHandler,
  WatchedScriptHashRequestedNotification,
} from "./src/notification-service";
export type {
  ElectrumProxyConfig,
  Endpoint,
  Logger,
  UpstreamEndpoint,
  WatchConfig,
} from "./src/types";

import { startFromEnv } from "./src/cli";

if (import.meta.main) {
  startFromEnv(Bun.env);
}
