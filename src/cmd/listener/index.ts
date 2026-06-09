import "dotenv/config";

import { ConsoleLoggerAdapter } from "../../adapters/logger/console-logger.adapter.js";
import {
  SlackSocketModeAdapter,
  toSlackLogLevel,
} from "../../adapters/slack/slack-socket-mode.adapter.js";
import { InMemoryTrackedThreadStoreAdapter } from "../../adapters/storage/in-memory-tracked-thread-store.adapter.js";
import { WorkerEventClientAdapter } from "../../adapters/worker/worker-event-client.adapter.js";
import { SlackListenerUseCase } from "../../modules/slack-listener/slack-listener.use-case.js";
import { loadListenerEnv } from "../../shared/env.js";

async function main(): Promise<void> {
  const env = loadListenerEnv();
  const logger = new ConsoleLoggerAdapter(env.logLevel);
  const slackSocket = new SlackSocketModeAdapter({
    botToken: env.slackBotToken,
    appToken: env.slackAppToken,
    logLevel: toSlackLogLevel(env.logLevel),
    logger,
  });
  const botUserId = env.slackBotUserId ?? (await slackSocket.resolveBotUserId());
  const workerClient = new WorkerEventClientAdapter({
    endpointUrl: env.workerSlackEventUrl,
    internalApiToken: env.workerInternalApiToken,
  });
  const trackedThreads = new InMemoryTrackedThreadStoreAdapter();
  const listener = new SlackListenerUseCase(
    workerClient,
    slackSocket,
    trackedThreads,
    logger,
    botUserId,
  );

  slackSocket.onMessage((event) => listener.handleRawSlackEvent(event));

  logger.info("Starting Slack Socket Mode listener");
  await slackSocket.start();
  logger.info("Slack Socket Mode listener started");
}

main().catch((error) => {
  const logger = new ConsoleLoggerAdapter("error");
  logger.error("Slack listener failed to start", {
    error: error instanceof Error ? error.message : "Unknown error",
  });
  process.exitCode = 1;
});
