import { expect, test } from "bun:test";
import { readConfig, readConfigFromEnv } from "./config";

test("reads proxy config defaults from empty config records", () => {
  expect(readConfig({})).toEqual({
    listen: {
      host: "127.0.0.1",
      port: 60001,
    },
    upstream: {
      host: "127.0.0.1",
      port: 50001,
      tls: false,
      tlsRejectUnauthorized: true,
    },
    logAddressRequests: false,
  });
});

test("reads proxy config overrides from config records", () => {
  expect(
    readConfig({
      LISTEN_HOST: "0.0.0.0",
      LISTEN_PORT: "61001",
      ELECTRUM_HOST: "btc1.shiftcrypto.io",
      ELECTRUM_PORT: "443",
      ELECTRUM_TLS: "true",
      ELECTRUM_TLS_REJECT_UNAUTHORIZED: "false",
      LOG_ADDRESS_REQUESTS: "true",
      TELEGRAM_BOT_TOKEN: "bot-token",
      TELEGRAM_CHAT_ID: "12345",
      TELEGRAM_CUSTOM_MESSAGE: "custom alert",
      TELEGRAM_DEBOUNCE_MS: "2500",
    }),
  ).toEqual({
    listen: {
      host: "0.0.0.0",
      port: 61001,
    },
    upstream: {
      host: "btc1.shiftcrypto.io",
      port: 443,
      tls: true,
      tlsRejectUnauthorized: false,
    },
    logAddressRequests: true,
    telegram: {
      botToken: "bot-token",
      chatId: "12345",
      customMessage: "custom alert",
      debounceMs: 2500,
    },
  });
});

test("rejects invalid port values", () => {
  expect(() => readConfig({ LISTEN_PORT: "nope" })).toThrow(
    "LISTEN_PORT must be a TCP port between 1 and 65535",
  );
});

test("rejects invalid address request log flags", () => {
  expect(() =>
    readConfig({
      LOG_ADDRESS_REQUESTS: "sometimes",
    }),
  ).toThrow("LOG_ADDRESS_REQUESTS must be true or false");
});

test("requires a Telegram chat id when a bot token is configured", () => {
  expect(() =>
    readConfig({
      TELEGRAM_BOT_TOKEN: "bot-token",
    }),
  ).toThrow("TELEGRAM_CHAT_ID is required when Telegram is configured");
});

test("requires a Telegram bot token when a chat id is configured", () => {
  expect(() =>
    readConfig({
      TELEGRAM_CHAT_ID: "12345",
    }),
  ).toThrow("TELEGRAM_BOT_TOKEN is required when Telegram is configured");
});

test("keeps readConfigFromEnv as a compatibility alias", () => {
  expect(readConfigFromEnv).toBe(readConfig);
});
