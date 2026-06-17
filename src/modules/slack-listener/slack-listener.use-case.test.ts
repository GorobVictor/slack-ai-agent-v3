import { describe, expect, it } from "vitest";

import type { LoggerPort } from "../../ports/logger.port.js";
import type { SlackMessengerPort } from "../../ports/slack-messenger.port.js";
import type { TrackedThreadStorePort } from "../../ports/tracked-thread-store.port.js";
import type { WorkerEventClientPort } from "../../ports/worker-event-client.port.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";
import { SlackListenerUseCase } from "./slack-listener.use-case.js";

const BOT_USER_ID = "UBOT";

describe("SlackListenerUseCase", () => {
  it("posts Worker replies back to Slack threads", async () => {
    const sentMessages: Array<{ channelId: string; threadTs: string; text: string }> = [];
    const workerEvents: SlackWorkerRequest[] = [];
    const useCase = new SlackListenerUseCase(
      workerClient({ status: "reply", text: "Hello from Think" }, workerEvents),
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
    expect(workerEvents[0]?.processingIntent).toBe("invoke");
    expect(workerEvents[1]).toMatchObject({
      source: "slack",
      teamId: "T123",
      channelId: "C123",
      userId: BOT_USER_ID,
      text: "Hello from Think",
      messageTs: "1710000000.000999",
      threadTs: "1710000000.000100",
      channelType: "channel",
      isMention: false,
      isThreadMessage: true,
      idempotencyKey: "slack:T123:C123:1710000000.000999",
      processingIntent: "capture",
    });
  });

  it("retries Slack reply posts before capturing the bot reply", async () => {
    const sentMessages: Array<{ channelId: string; threadTs: string; text: string }> = [];
    const workerEvents: SlackWorkerRequest[] = [];
    const postAttempts = { count: 0 };
    const useCase = new SlackListenerUseCase(
      workerClient({ status: "reply", text: "Hello after retry" }, workerEvents),
      flakyMessenger(sentMessages, postAttempts, 2),
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

    expect(postAttempts.count).toBe(3);
    expect(sentMessages).toEqual([
      {
        channelId: "C123",
        threadTs: "1710000000.000100",
        text: "Hello after retry",
      },
    ]);
    expect(workerEvents[1]).toMatchObject({
      text: "Hello after retry",
      processingIntent: "capture",
    });
  });

  it("posts a fallback Slack reply when Worker delivery fails for invoke events", async () => {
    const sentMessages: Array<{ channelId: string; threadTs: string; text: string }> = [];
    const useCase = new SlackListenerUseCase(
      failingWorkerClient(),
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
        text: "Something went wrong while processing your request. Please try again.",
      },
    ]);
  });

  it("posts a fallback Slack reply when Worker returns an error response", async () => {
    const sentMessages: Array<{ channelId: string; threadTs: string; text: string }> = [];
    const workerEvents: SlackWorkerRequest[] = [];
    const useCase = new SlackListenerUseCase(
      workerClient(
        {
          status: "error",
          code: "SLACK_EVENT_PROCESSING_FAILED",
          message: "Failed to process Slack event",
        },
        workerEvents,
      ),
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

    expect(workerEvents[0]?.processingIntent).toBe("invoke");
    expect(sentMessages).toEqual([
      {
        channelId: "C123",
        threadTs: "1710000000.000100",
        text: "Something went wrong while processing your request. Please try again.",
      },
    ]);
  });

  it("does not post Slack messages for no_reply responses", async () => {
    const sentMessages: Array<{ channelId: string; threadTs: string; text: string }> = [];
    const workerEvents: SlackWorkerRequest[] = [];
    const useCase = new SlackListenerUseCase(
      workerClient({ status: "no_reply" }, workerEvents),
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
    expect(workerEvents).toHaveLength(1);
  });

  it("forwards unmentioned channel messages as capture-only", async () => {
    const workerEvents: SlackWorkerRequest[] = [];
    const useCase = new SlackListenerUseCase(
      workerClient({ status: "no_reply" }, workerEvents),
      messenger([]),
      trackedThreads(),
      logger,
      BOT_USER_ID,
    );

    await useCase.handleRawSlackEvent({
      event: {
        type: "message",
        team: "T123",
        channel: "C123",
        channel_type: "channel",
        user: "U123",
        text: "ambient channel message",
        ts: "1710000000.000100",
      },
    });

    expect(workerEvents).toHaveLength(1);
    expect(workerEvents[0]).toMatchObject({
      channelId: "C123",
      processingIntent: "capture",
    });
  });
});

function workerClient(
  response: Awaited<ReturnType<WorkerEventClientPort["sendSlackMessageEvent"]>>,
  events: SlackWorkerRequest[] = [],
): WorkerEventClientPort {
  return {
    async sendSlackMessageEvent(event) {
      events.push(event);
      return response;
    },
    async streamSlackMessageEvent(event, callbacks) {
      events.push(event);

      if (response.status === "reply") {
        await callbacks.onDelta({ text: response.text });
      }

      return response;
    },
  };
}

function failingWorkerClient(): WorkerEventClientPort {
  return {
    async sendSlackMessageEvent() {
      throw new Error("Worker unavailable");
    },
    async streamSlackMessageEvent() {
      throw new Error("Worker unavailable");
    },
  };
}

function messenger(
  sentMessages: Array<{ channelId: string; threadTs: string; text: string }>,
): SlackMessengerPort {
  const streamThreads = new Map<string, string>();

  return {
    async sendMessage(input) {
      sentMessages.push(input);
      return {
        messageTs: "1710000000.000999",
      };
    },
    async startStream(input) {
      streamThreads.set("1710000000.000999", input.threadTs);
      return {
        messageTs: "1710000000.000999",
      };
    },
    async appendStream() {},
    async stopStream(input) {
      sentMessages.push({
        channelId: input.channelId,
        threadTs: streamThreads.get(input.streamTs) ?? input.streamTs,
        text: input.text ?? "",
      });
      return {
        messageTs: input.streamTs,
      };
    },
  };
}

function flakyMessenger(
  sentMessages: Array<{ channelId: string; threadTs: string; text: string }>,
  attempts: { count: number },
  failuresBeforeSuccess: number,
): SlackMessengerPort {
  const streamThreads = new Map<string, string>();

  return {
    async sendMessage(input) {
      attempts.count += 1;

      if (attempts.count <= failuresBeforeSuccess) {
        throw new Error("Slack API unavailable");
      }

      sentMessages.push(input);
      return {
        messageTs: "1710000000.000999",
      };
    },
    async startStream(input) {
      attempts.count += 1;

      if (attempts.count <= failuresBeforeSuccess) {
        throw new Error("Slack API unavailable");
      }

      streamThreads.set("1710000000.000999", input.threadTs);
      return {
        messageTs: "1710000000.000999",
      };
    },
    async appendStream() {},
    async stopStream(input) {
      sentMessages.push({
        channelId: input.channelId,
        threadTs: streamThreads.get(input.streamTs) ?? input.streamTs,
        text: input.text ?? "",
      });
      return {
        messageTs: input.streamTs,
      };
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
