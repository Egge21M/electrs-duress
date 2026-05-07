import { afterEach, expect, test } from "bun:test";
import net, { type Server, type Socket } from "node:net";
import { createElectrumProxy } from "./proxy";

const fixtureXpub =
  "xpub6DDeqdmzCpioRhR7fgHQAibbTMNRcPnW1qcYrrtAR5YEAWztVK3G6HuAky6Y3mZzB4UCqVifkXFY2qBUv8rJCHiT1JfoCLtUerZYp653yss";
const watchedScriptHash =
  "aa7ea9c5470f1a8186bfcac43af945464514633106097c14b8375bfcba7ef21f";
const unwatchedScriptHash =
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const servers: Server[] = [];
const sockets: Socket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.destroy();
  }

  await Promise.all(servers.splice(0).map(closeServer));
});

test("alerts when a watched script-hash balance is requested", async () => {
  const logs: string[] = [];
  const upstream = net.createServer((socket) => {
    socket.on("data", () => {
      socket.write('{"id":1,"result":{"confirmed":0,"unconfirmed":0}}\n');
    });
  });

  await listen(upstream, "127.0.0.1", 0);
  servers.push(upstream);

  const upstreamAddress = tcpAddress(upstream);
  const proxy = createElectrumProxy({
    config: {
      listen: {
        host: "127.0.0.1",
        port: 0,
      },
      upstream: {
        host: "127.0.0.1",
        port: upstreamAddress.port,
        tls: false,
        tlsRejectUnauthorized: true,
      },
      watch: {
        xpub: fixtureXpub,
        addressCount: 1,
        chain: 0,
      },
    },
    logger: {
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    },
  });

  await listen(proxy, "127.0.0.1", 0);
  servers.push(proxy);

  const proxyAddress = tcpAddress(proxy);
  const walletSocket = await connect("127.0.0.1", proxyAddress.port);
  sockets.push(walletSocket);

  walletSocket.write(
    `${JSON.stringify({
      id: 1,
      method: "blockchain.scripthash.get_balance",
      params: [watchedScriptHash],
    })}\n`,
  );

  await readJsonLine(walletSocket, 5_000);

  expect(
    logs.some((line) =>
      line.includes(
        `[alert] watched address balance requested client=`,
      ) &&
      line.includes("address=1Exq3M51dXqk8eHnosigC5DPDVYbxz9934") &&
      line.includes("path=m/0/0") &&
      line.includes(`scripthash=${watchedScriptHash}`),
    ),
  ).toBe(true);
});

test("does not alert when an unwatched script-hash balance is requested", async () => {
  const logs: string[] = [];
  const upstream = net.createServer((socket) => {
    socket.on("data", () => {
      socket.write('{"id":1,"result":{"confirmed":0,"unconfirmed":0}}\n');
    });
  });

  await listen(upstream, "127.0.0.1", 0);
  servers.push(upstream);

  const upstreamAddress = tcpAddress(upstream);
  const proxy = createElectrumProxy({
    config: {
      listen: {
        host: "127.0.0.1",
        port: 0,
      },
      upstream: {
        host: "127.0.0.1",
        port: upstreamAddress.port,
        tls: false,
        tlsRejectUnauthorized: true,
      },
      watch: {
        xpub: fixtureXpub,
        addressCount: 1,
        chain: 0,
      },
    },
    logger: {
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    },
  });

  await listen(proxy, "127.0.0.1", 0);
  servers.push(proxy);

  const proxyAddress = tcpAddress(proxy);
  const walletSocket = await connect("127.0.0.1", proxyAddress.port);
  sockets.push(walletSocket);

  walletSocket.write(
    `${JSON.stringify({
      id: 1,
      method: "blockchain.scripthash.get_balance",
      params: [unwatchedScriptHash],
    })}\n`,
  );

  await readJsonLine(walletSocket, 5_000);

  const alertLogs = logs.filter((line) =>
    line.includes("[alert] watched address balance requested"),
  );

  expect(alertLogs).toEqual([]);
  expect(
    logs.some((line) =>
      line.includes(
        `method=blockchain.scripthash.get_balance target=${unwatchedScriptHash} id=1`,
      ),
    ),
  ).toBe(true);
});

function listen(server: Server, host: string, port: number) {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function connect(host: string, port: number) {
  return new Promise<Socket>((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const onError = (error: Error) => {
      socket.off("connect", onConnect);
      reject(error);
    };

    const onConnect = () => {
      socket.off("error", onError);
      resolve(socket);
    };

    socket.once("error", onError);
    socket.once("connect", onConnect);
  });
}

function readJsonLine(socket: Socket, timeoutMs: number) {
  return new Promise<unknown>((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for response"));
    }, timeoutMs);

    const onData = (chunk: Buffer | string) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex).trim();
      cleanup();
      resolve(JSON.parse(line));
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
    };

    socket.on("data", onData);
    socket.once("error", onError);
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function tcpAddress(server: Server) {
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Server did not bind to a TCP port");
  }

  return address;
}
