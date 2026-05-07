import net, { type Server, type Socket } from "node:net";
import tls from "node:tls";
import { createElectrumRequestObserver } from "./electrum-observer";
import { createXpubWatch, type XpubWatch } from "./xpub-watch";
import type { ElectrumProxyConfig, Logger, UpstreamEndpoint } from "./types";

export interface CreateElectrumProxyOptions {
  config: ElectrumProxyConfig;
  logger?: Logger;
}

export function createElectrumProxy(
  options: CreateElectrumProxyOptions,
): Server {
  const { config } = options;
  const logger = options.logger ?? console;
  const watch = config.watch ? createXpubWatch(config.watch) : undefined;

  const server = net.createServer((walletSocket) => {
    const clientLabel = formatRemote(walletSocket);
    const electrumSocket = createUpstreamSocket(config.upstream, () => {
      logger.log(`[connect] ${clientLabel} -> ${formatUpstream(config.upstream)}`);
    });

    const requestObserver = createElectrumRequestObserver(
      clientLabel,
      (request) => {
        maybeLogWatchedBalanceRequest(request, watch, logger);
        logger.log(
          `[address request] client=${request.clientLabel} method=${request.method} target=${String(
            request.target,
          )} id=${String(request.id ?? "notification")}`,
        );
      },
    );

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
        `[upstream error] ${clientLabel} -> ${formatUpstream(
          config.upstream,
        )}: ${error.message}`,
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

function maybeLogWatchedBalanceRequest(
  request: {
    clientLabel: string;
    id: string | number | null;
    method: string;
    target: unknown;
  },
  watch: XpubWatch | undefined,
  logger: Logger,
) {
  if (
    !watch ||
    request.method !== "blockchain.scripthash.get_balance" ||
    typeof request.target !== "string"
  ) {
    return;
  }

  const watchedAddress = watch.byScriptHash.get(request.target.toLowerCase());
  if (!watchedAddress) {
    return;
  }

  logger.error(
    `[alert] watched address balance requested client=${request.clientLabel} address=${watchedAddress.address} path=${watchedAddress.path} scripthash=${watchedAddress.scriptHash} id=${String(
      request.id ?? "notification",
    )}`,
  );
}

export function formatUpstream(upstream: UpstreamEndpoint) {
  const protocol = upstream.tls ? "tls" : "tcp";
  return `${protocol}://${upstream.host}:${upstream.port}`;
}

function createUpstreamSocket(upstream: UpstreamEndpoint, onConnect: () => void) {
  if (upstream.tls) {
    return tls.connect(
      {
        host: upstream.host,
        port: upstream.port,
        rejectUnauthorized: upstream.tlsRejectUnauthorized,
        servername: upstream.host,
      },
      onConnect,
    );
  }

  return net.createConnection(
    { host: upstream.host, port: upstream.port },
    onConnect,
  );
}

function formatRemote(socket: Socket) {
  return `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "unknown"}`;
}
