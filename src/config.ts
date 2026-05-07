import type { ElectrumProxyConfig } from "./types";

export function readConfigFromEnv(
  env: Record<string, string | undefined>,
): ElectrumProxyConfig {
  return {
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
