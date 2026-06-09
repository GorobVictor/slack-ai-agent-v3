import { describe, expect, it } from "vitest";

import type { LoggerPort } from "../../ports/logger.port.js";
import type { SlackMessengerPort } from "../../ports/slack-messenger.port.js";
import type { TrackedThreadStorePort } from "../../ports/tracked-thread-store.port.js";
import type { WorkerEventClientPort } from "../../ports/worker-event-client.port.js";
import { SlackListenerUseCase } from "./slack-listener.use-case.js";

const BOT_USER_ID = "UBOT";

describe("SlackListenerUseCase", () => {
  it("posts Worker replies back to Slack threads", async () => {
    const sentMessages: Array<{ channelId: string; threadTs: string; text: string }> = [];
    const useCase = new SlackListenerUseCase(
      workerClient({ status: "reply", text: "Hello from Think" }),
      messenger(sentMessages),
      trackedThreads(),
      logger,
      BOT_USER_ID,
    );

    await useCase.handleRawSlackEvent({
      body: {
        event_id: "Ev123",
        team_id: "T123",
      },
      event: {
        type: "app_mention",
        channel: "C123",
        user: "U123",
        text: "<@UBOT> hi",
        ts: "1710000000.000100",
      },
    });

    expect(sentMessages).toEqual([
      {
        channelId: "C123",
        threadTs: "1710000000.000100",
        text: "Hello from Think",
      },
    ]);
  });

  it("does not post Slack messages for no_reply responses", async () => {
    const sentMessages: Array<{ channelId: string; threadTs: string; text: string }> = [];
    const useCase = new SlackListenerUseCase(
      workerClient({ status: "no_reply" }),
      messenger(sentMessages),
      trackedThreads(),
      logger,
      BOT_USER_ID,
    );

    await useCase.handleRawSlackEvent({
      event: {
        type: "message",
        team: "T123",
        channel: "D123",
        channel_type: "im",
        user: "U123",
        text: "hi",
        ts: "1710000000.000100",
      },
    });

    expect(sentMessages).toEqual([]);
  });
});

function workerClient(response: Awaited<ReturnType<WorkerEventClientPort["sendSlackMessageEvent"]>>): WorkerEventClientPort {
  return {
    async sendSlackMessageEvent() {
      return response;
    },
  };
}

function messenger(
  sentMessages: Array<{ channelId: string; threadTs: string; text: string }>,
): SlackMessengerPort {
  return {
    async sendMessage(input) {
      sentMessages.push(input);
    },
  };
}

function trackedThreads(): TrackedThreadStorePort {
  const keys = new Set<string>();

  return {
    async hasThread(key) {
      return keys.has(key);
    },
    async addThread(key) {
      keys.add(key);
    },
  };
}

const logger: LoggerPort = {
  info() {},
  warn() {},
  error() {},
};
