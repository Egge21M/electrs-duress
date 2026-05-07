import { expect, test } from "bun:test";
import { readConfigFromEnv } from "./config";

test("reads proxy config defaults from an empty environment", () => {
  expect(readConfigFromEnv({})).toEqual({
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
  });
});

test("reads proxy config overrides from the environment", () => {
  expect(
    readConfigFromEnv({
      LISTEN_HOST: "0.0.0.0",
      LISTEN_PORT: "61001",
      ELECTRUM_HOST: "btc1.shiftcrypto.io",
      ELECTRUM_PORT: "443",
      ELECTRUM_TLS: "true",
      ELECTRUM_TLS_REJECT_UNAUTHORIZED: "false",
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
  });
});

test("rejects invalid port values", () => {
  expect(() => readConfigFromEnv({ LISTEN_PORT: "nope" })).toThrow(
    "LISTEN_PORT must be a TCP port between 1 and 65535",
  );
});
