import { readConfigFromEnv } from "./config";
import { createElectrumProxy, formatUpstream } from "./proxy";

export function startFromEnv(env: Record<string, string | undefined>) {
  const config = readConfigFromEnv(env);
  const server = createElectrumProxy({ config });

  server.on("error", () => {
    process.exitCode = 1;
  });

  server.listen(config.listen.port, config.listen.host, () => {
    console.log(
      `electrs-duress listening on ${config.listen.host}:${config.listen.port}, forwarding to ${formatUpstream(
        config.upstream,
      )}`,
    );
  });

  return server;
}
