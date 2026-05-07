import type { ElectrumProxyConfig } from "./types";

export type ConfigRecord = Record<string, string | undefined>;

export function readConfig(
  configEntries: ConfigRecord,
): ElectrumProxyConfig {
  const telegram = readTelegramConfig(configEntries);

  const config: ElectrumProxyConfig = {
    listen: {
      host: configEntries.LISTEN_HOST ?? "127.0.0.1",
      port: parsePort(configEntries.LISTEN_PORT, 60001, "LISTEN_PORT"),
    },
    upstream: {
      host: configEntries.ELECTRUM_HOST ?? "127.0.0.1",
      port: parsePort(configEntries.ELECTRUM_PORT, 50001, "ELECTRUM_PORT"),
      tls: parseBoolean(configEntries.ELECTRUM_TLS, false, "ELECTRUM_TLS"),
      tlsRejectUnauthorized: parseBoolean(
        configEntries.ELECTRUM_TLS_REJECT_UNAUTHORIZED,
        true,
        "ELECTRUM_TLS_REJECT_UNAUTHORIZED",
      ),
    },
    logAddressRequests: parseBoolean(
      configEntries.LOG_ADDRESS_REQUESTS,
      false,
      "LOG_ADDRESS_REQUESTS",
    ),
  };

  if (telegram) {
    config.telegram = telegram;
  }

  return config;
}

export const readConfigFromEnv = readConfig;

function readTelegramConfig(configEntries: ConfigRecord) {
  const botToken = configEntries.TELEGRAM_BOT_TOKEN;
  const chatId = configEntries.TELEGRAM_CHAT_ID;

  if (
    !botToken &&
    !chatId &&
    !configEntries.TELEGRAM_DEBOUNCE_MS &&
    !configEntries.TELEGRAM_CUSTOM_MESSAGE
  ) {
    return undefined;
  }

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required when Telegram is configured");
  }

  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID is required when Telegram is configured");
  }

  return {
    botToken,
    chatId,
    customMessage: configEntries.TELEGRAM_CUSTOM_MESSAGE,
    debounceMs: parseIntegerInRange(
      configEntries.TELEGRAM_DEBOUNCE_MS,
      5_000,
      "TELEGRAM_DEBOUNCE_MS",
      0,
      60_000,
    ),
  };
}

function parsePort(value: string | undefined, fallback: number, name: string) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`${name} must be a TCP port between 1 and 65535`);
  }

  return parsed;
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
  name: string,
) {
  if (value === undefined || value === "") {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}

function parseIntegerInRange(
  value: string | undefined,
  fallback: number,
  name: string,
  min: number,
  max: number,
) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}
