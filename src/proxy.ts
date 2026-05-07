import net, { type Server, type Socket } from "node:net";
import tls from "node:tls";
import { createElectrumRequestObserver } from "./electrum-observer";
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

  const server = net.createServer((walletSocket) => {
    const clientLabel = formatRemote(walletSocket);
    const electrumSocket = createUpstreamSocket(config.upstream, () => {
      logger.log(`[connect] ${clientLabel} -> ${formatUpstream(config.upstream)}`);
    });

    const requestObserver = createElectrumRequestObserver(
      clientLabel,
      (request) => {
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
