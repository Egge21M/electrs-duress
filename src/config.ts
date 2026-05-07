import type { ElectrumProxyConfig } from "./types";

export function readConfigFromEnv(
  env: Record<string, string | undefined>,
): ElectrumProxyConfig {
  const telegram = readTelegramConfigFromEnv(env);
  const watch = env.WATCH_XPUB
    ? {
        xpub: env.WATCH_XPUB,
        addressCount: parseIntegerInRange(
          env.WATCH_ADDRESS_COUNT,
          200,
          "WATCH_ADDRESS_COUNT",
          1,
          10_000,
        ),
        chain: parseIntegerInRange(env.WATCH_CHAIN, 0, "WATCH_CHAIN", 0, 1),
      }
    : undefined;

  const config: ElectrumProxyConfig = {
    listen: {
      host: env.LISTEN_HOST ?? "127.0.0.1",
      port: parsePort(env.LISTEN_PORT, 60001, "LISTEN_PORT"),
    },
    upstream: {
      host: env.ELECTRUM_HOST ?? "127.0.0.1",
      port: parsePort(env.ELECTRUM_PORT, 50001, "ELECTRUM_PORT"),
      tls: parseBoolean(env.ELECTRUM_TLS, false, "ELECTRUM_TLS"),
      tlsRejectUnauthorized: parseBoolean(
        env.ELECTRUM_TLS_REJECT_UNAUTHORIZED,
        true,
        "ELECTRUM_TLS_REJECT_UNAUTHORIZED",
      ),
    },
    logAddressRequests: parseBoolean(
      env.LOG_ADDRESS_REQUESTS,
      false,
      "LOG_ADDRESS_REQUESTS",
    ),
  };

  if (telegram) {
    config.telegram = telegram;
  }

  if (watch) {
    config.watch = watch;
  }

  return config;
}

function readTelegramConfigFromEnv(env: Record<string, string | undefined>) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken && !chatId && !env.TELEGRAM_DEBOUNCE_MS) {
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
    debounceMs: parseIntegerInRange(
      env.TELEGRAM_DEBOUNCE_MS,
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
