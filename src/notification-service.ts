import type { Logger } from "./types";
import type { WatchedAddress } from "./xpub-watch";

export interface WatchedScriptHashRequestedNotification {
  type: "watched-scripthash-requested";
  clientLabel: string;
  id: string | number | null;
  method: string;
  scriptHash: string;
  watchedAddress: WatchedAddress;
}

export type Notification = WatchedScriptHashRequestedNotification;

export interface NotificationHandler<TNotification extends Notification = Notification> {
  handle(notification: TNotification): void | Promise<void>;
}

export class NotificationService {
  readonly #handlers = new Set<NotificationHandler>();

  register(handler: NotificationHandler) {
    this.#handlers.add(handler);

    return () => {
      this.#handlers.delete(handler);
    };
  }

  async notify(notification: Notification) {
    const results = [...this.#handlers].map((handler) =>
      handler.handle(notification),
    );

    await Promise.all(results);
  }
}

export function createConsoleNotificationHandler(
  logger: Logger,
): NotificationHandler {
  return {
    handle(notification) {
      switch (notification.type) {
        case "watched-scripthash-requested":
          logger.error(
            `[alert] watched script-hash requested client=${notification.clientLabel} method=${notification.method} address=${notification.watchedAddress.address} path=${notification.watchedAddress.path} scripthash=${notification.scriptHash} id=${String(
              notification.id ?? "notification",
            )}`,
          );
          return;
      }
    },
  };
}

export function createDefaultNotificationService(logger: Logger) {
  const notificationService = new NotificationService();
  notificationService.register(createConsoleNotificationHandler(logger));
  return notificationService;
}
