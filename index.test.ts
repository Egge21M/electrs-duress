import { afterEach, expect, test } from "bun:test";
import net, { type Server, type Socket } from "node:net";
import { createElectrumProxy } from "./index";

const servers: Server[] = [];
const sockets: Socket[] = [];

afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.destroy();
  }

  await Promise.all(servers.splice(0).map(closeServer));
});

test("forwards Electrum requests to btc1.shiftcrypto.io:443 and logs script-hash lookups", async () => {
  const logs: string[] = [];
  const scriptHash = "0".repeat(64);
  const proxy = createElectrumProxy({
    listenHost: "127.0.0.1",
    listenPort: 0,
    upstreamHost: "btc1.shiftcrypto.io",
    upstreamPort: 443,
    upstreamTls: true,
    upstreamTlsRejectUnauthorized: false,
    logger: {
      log: (message) => logs.push(message),
      error: (message) => logs.push(message),
    },
  });

  await listen(proxy, "127.0.0.1", 0);
  servers.push(proxy);

  const address = proxy.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Proxy did not bind to a TCP port");
  }

  const walletSocket = await connect("127.0.0.1", address.port);
  sockets.push(walletSocket);

  walletSocket.write(
    `${JSON.stringify({
      id: 1,
      method: "blockchain.scripthash.get_balance",
      params: [scriptHash],
    })}\n`,
  );

  const response = await readJsonLine(walletSocket, 15_000);
  expect(response).toMatchObject({
    id: 1,
    result: {
      confirmed: expect.any(Number),
      unconfirmed: expect.any(Number),
    },
  });

  expect(
    logs.some((line) =>
      line.includes(
        `method=blockchain.scripthash.get_balance target=${scriptHash} id=1`,
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
      reject(new Error(`Timed out waiting for Electrum response`));
    }, timeoutMs);

    const onData = (chunk: Buffer | string) => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line.length > 0) {
          cleanup();
          try {
            resolve(JSON.parse(line));
          } catch (error) {
            reject(error);
          }
          return;
        }

        newlineIndex = buffer.indexOf("\n");
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("Socket closed before an Electrum response arrived"));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
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
