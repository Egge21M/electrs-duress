import { Bot } from "grammy";
import type { Logger, TelegramNotificationConfig } from "./types";
import type { Notification, NotificationHandler } from "./notification-service";

const telegramMessageLimit = 4096;

export interface TelegramMessageSender {
  sendMessage(chatId: string, text: string): Promise<void>;
}

export interface TelegramNotificationHandlerOptions {
  chatId: string;
  debounceMs: number;
  logger?: Logger;
  sender: TelegramMessageSender;
}

export class TelegramNotificationHandler implements NotificationHandler {
  readonly #chatId: string;
  readonly #debounceMs: number;
  readonly #logger: Logger | undefined;
  readonly #pending: string[] = [];
  readonly #sender: TelegramMessageSender;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: TelegramNotificationHandlerOptions) {
    this.#chatId = options.chatId;
    this.#debounceMs = options.debounceMs;
    this.#logger = options.logger;
    this.#sender = options.sender;
  }

  handle(notification: Notification) {
    this.#pending.push(formatNotification(notification));
    this.#scheduleFlush();
  }

  async flush() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    const pending = this.#pending.splice(0);
    if (pending.length === 0) {
      return;
    }

    const message = [
      `electrs-duress alert: ${pending.length} watched request${
        pending.length === 1 ? "" : "s"
      }`,
      "",
      ...pending,
    ].join("\n");

    try {
      for (const chunk of chunkMessage(message)) {
        await this.#sender.sendMessage(this.#chatId, chunk);
      }
    } catch (error) {
      this.#logger?.error(
        `[telegram error] ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  #scheduleFlush() {
    if (this.#timer) {
      clearTimeout(this.#timer);
    }

    this.#timer = setTimeout(() => {
      void this.flush();
    }, this.#debounceMs);
  }
}

export function createTelegramNotificationHandler(
  config: TelegramNotificationConfig,
  logger?: Logger,
) {
  const bot = new Bot(config.botToken);
  return new TelegramNotificationHandler({
    chatId: config.chatId,
    debounceMs: config.debounceMs,
    logger,
    sender: {
      sendMessage: async (chatId, text) => {
        await bot.api.sendMessage(chatId, text);
      },
    },
  });
}

function formatNotification(notification: Notification) {
  switch (notification.type) {
    case "watched-scripthash-requested":
      return [
        `method: ${notification.method}`,
        `address: ${notification.watchedAddress.address}`,
        `path: ${notification.watchedAddress.path}`,
        `scripthash: ${notification.scriptHash}`,
        `client: ${notification.clientLabel}`,
        `id: ${String(notification.id ?? "notification")}`,
      ].join("\n");
  }
}

function chunkMessage(message: string) {
  const chunks: string[] = [];
  for (let offset = 0; offset < message.length; offset += telegramMessageLimit) {
    chunks.push(message.slice(offset, offset + telegramMessageLimit));
  }

  return chunks.length > 0 ? chunks : [message];
}
