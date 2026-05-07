import { createElectrsDuressRuntime } from "./app";
import { formatUpstream } from "./proxy";
import type { Logger } from "./types";

export interface StartFromEnvOptions {
  logger?: Logger;
}

export function startFromEnv(
  env: Record<string, string | undefined>,
  options: StartFromEnvOptions = {},
) {
  const logger = options.logger ?? console;
  const { config, server } = createElectrsDuressRuntime({ env, logger });

  server.on("error", () => {
    process.exitCode = 1;
  });

  server.listen(config.listen.port, config.listen.host, () => {
    logger.log(
      `electrs-duress listening on ${config.listen.host}:${config.listen.port}, forwarding to ${formatUpstream(
        config.upstream,
      )}`,
    );
  });

  return server;
}
