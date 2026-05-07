import net, { type Server, type Socket } from "node:net";
import tls from "node:tls";
import { StringDecoder } from "node:string_decoder";

export interface ElectrumProxyConfig {
  listenHost: string;
  listenPort: number;
  upstreamHost: string;
  upstreamPort: number;
  upstreamTls: boolean;
  upstreamTlsRejectUnauthorized: boolean;
  logger?: Logger;
}

interface Logger {
  log(message: string): void;
  error(message: string): void;
}

const addressRequestMethods = new Set([
  "blockchain.address.get_balance",
  "blockchain.address.get_history",
  "blockchain.address.get_mempool",
  "blockchain.address.listunspent",
  "blockchain.address.subscribe",
  "blockchain.scripthash.get_balance",
  "blockchain.scripthash.get_history",
  "blockchain.scripthash.get_mempool",
  "blockchain.scripthash.listunspent",
  "blockchain.scripthash.subscribe",
]);

export function createElectrumProxy(config: ElectrumProxyConfig): Server {
  const logger = config.logger ?? console;

  const server = net.createServer((walletSocket) => {
    const clientLabel = formatRemote(walletSocket);
    const electrumSocket = createUpstreamSocket(config, () => {
      logger.log(
        `[connect] ${clientLabel} -> ${formatUpstream(config)}`,
      );
    });

    const requestObserver = createElectrumRequestObserver(clientLabel, logger);

    walletSocket.on("data", (chunk) => {
      requestObserver.observe(chunk);
      if (!electrumSocket.destroyed) {
        electrumSocket.write(chunk);
      }
    });

    electrumSocket.on("data", (chunk) => {
      if (!walletSocket.destroyed) {
        walletSocket.write(chunk);
      }
    });

    walletSocket.on("error", (error) => {
      logger.error(`[wallet error] ${clientLabel}: ${error.message}`);
    });

    electrumSocket.on("error", (error) => {
      logger.error(
        `[upstream error] ${clientLabel} -> ${formatUpstream(config)}: ${error.message}`,
      );
    });

    walletSocket.on("close", () => {
      electrumSocket.end();
      logger.log(`[disconnect] ${clientLabel}`);
    });

    electrumSocket.on("close", () => {
      walletSocket.end();
    });
  });

  server.on("error", (error) => {
    logger.error(`[server error] ${error.message}`);
  });

  return server;
}

export function readConfigFromEnv(env: Record<string, string | undefined>) {
  return {
    listenHost: env.LISTEN_HOST ?? "127.0.0.1",
    listenPort: parsePort(env.LISTEN_PORT, 60001, "LISTEN_PORT"),
    upstreamHost: env.ELECTRUM_HOST ?? "127.0.0.1",
    upstreamPort: parsePort(env.ELECTRUM_PORT, 50001, "ELECTRUM_PORT"),
    upstreamTls: parseBoolean(env.ELECTRUM_TLS, false, "ELECTRUM_TLS"),
    upstreamTlsRejectUnauthorized: parseBoolean(
      env.ELECTRUM_TLS_REJECT_UNAUTHORIZED,
      true,
      "ELECTRUM_TLS_REJECT_UNAUTHORIZED",
    ),
  } satisfies ElectrumProxyConfig;
}

if (import.meta.main) {
  const config = readConfigFromEnv(Bun.env);
  const server = createElectrumProxy(config);

  server.on("error", () => {
    process.exitCode = 1;
  });

  server.listen(config.listenPort, config.listenHost, () => {
    console.log(
      `electrs-duress listening on ${config.listenHost}:${config.listenPort}, forwarding to ${formatUpstream(
        config,
      )}`,
    );
  });
}

function createUpstreamSocket(config: ElectrumProxyConfig, onConnect: () => void) {
  if (config.upstreamTls) {
    return tls.connect(
      {
        host: config.upstreamHost,
        port: config.upstreamPort,
        rejectUnauthorized: config.upstreamTlsRejectUnauthorized,
        servername: config.upstreamHost,
      },
      onConnect,
    );
  }

  return net.createConnection(
    { host: config.upstreamHost, port: config.upstreamPort },
    onConnect,
  );
}

function createElectrumRequestObserver(clientLabel: string, logger: Logger) {
  const decoder = new StringDecoder("utf8");
  let buffered = "";

  return {
    observe(chunk: Buffer | string) {
      buffered += typeof chunk === "string" ? chunk : decoder.write(chunk);

      let newlineIndex = buffered.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffered.slice(0, newlineIndex).trim();
        buffered = buffered.slice(newlineIndex + 1);

        if (line.length > 0) {
          logAddressRequest(line, clientLabel, logger);
        }

        newlineIndex = buffered.indexOf("\n");
      }
    },
  };
}

function logAddressRequest(line: string, clientLabel: string, logger: Logger) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }

  const requests = Array.isArray(parsed) ? parsed : [parsed];
  for (const request of requests) {
    if (!isJsonRpcRequest(request) || !addressRequestMethods.has(request.method)) {
      continue;
    }

    const target = request.params[0];
    logger.log(
      `[address request] client=${clientLabel} method=${request.method} target=${String(
        target,
      )} id=${String(request.id ?? "notification")}`,
    );
  }
}

function isJsonRpcRequest(value: unknown): value is {
  id?: string | number | null;
  method: string;
  params: unknown[];
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { method?: unknown; params?: unknown };
  return (
    typeof candidate.method === "string" &&
    Array.isArray(candidate.params) &&
    candidate.params.length > 0
  );
}

function formatRemote(socket: Socket) {
  return `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "unknown"}`;
}

function formatUpstream(config: ElectrumProxyConfig) {
  const protocol = config.upstreamTls ? "tls" : "tcp";
  return `${protocol}://${config.upstreamHost}:${config.upstreamPort}`;
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
