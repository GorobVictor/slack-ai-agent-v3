import { describe, expect, it } from "vitest";

import type { LoggerPort } from "../../ports/logger.port.js";
import type { SkillReflectionQueuePort } from "../../ports/skill-reflection-queue.port.js";
import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import type { ThinkSessionPort } from "../../ports/think-session.port.js";
import { HandleSlackMessageUseCase } from "./handle-slack-message.use-case.js";
import type { SlackWorkerRequest } from "./slack.types.js";

describe("HandleSlackMessageUseCase", () => {
  it("submits Slack messages to a resolved Think session", async () => {
    const calls: Array<{ sessionId: string; event: SlackWorkerRequest }> = [];
    const saved: SlackWorkerRequest[] = [];
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage(input) {
          calls.push(input);
          return { text: "Hello from Think" };
        },
      } satisfies ThinkSessionPort,
      history(saved),
      logger,
    );

    await expect(
      useCase.execute(event({ processingIntent: "invoke", threadTs: "1710000000.000100" })),
    ).resolves.toEqual({
      status: "reply",
      text: "Hello from Think",
      threadTs: "1710000000.000100",
    });
    expect(calls[0]?.sessionId).toBe("slack:T123:channel:C123:thread:1710000000.000100");
    expect(saved).toHaveLength(1);
  });

  it("queues skill reflection after successful invoke replies", async () => {
    const queued: Array<{ event: SlackWorkerRequest; assistantReply: string }> = [];
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: "Hello from Think" };
        },
      } satisfies ThinkSessionPort,
      history([]),
      logger,
      queue(queued),
    );

    await expect(useCase.execute(event({ processingIntent: "invoke" }))).resolves.toEqual({
      status: "reply",
      text: "Hello from Think",
      threadTs: "1710000000.000200",
    });
    expect(queued).toEqual([
      {
        event: event({ processingIntent: "invoke" }),
        assistantReply: "Hello from Think",
      },
    ]);
  });

  it("returns the Slack reply when queueing skill reflection fails", async () => {
    const warnings: unknown[] = [];
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: "Hello from Think" };
        },
      } satisfies ThinkSessionPort,
      history([]),
      {
        ...logger,
        warn(_message, context) {
          warnings.push(context);
        },
      },
      failingQueue(),
    );

    await expect(useCase.execute(event({ processingIntent: "invoke" }))).resolves.toEqual({
      status: "reply",
      text: "Hello from Think",
      threadTs: "1710000000.000200",
    });
    expect(warnings).toHaveLength(1);
  });

  it("captures messages without invoking Think for capture-only events", async () => {
    const calls: Array<{ sessionId: string; event: SlackWorkerRequest }> = [];
    const saved: SlackWorkerRequest[] = [];
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage(input) {
          calls.push(input);
          return { text: "Should not be called" };
        },
      } satisfies ThinkSessionPort,
      history(saved),
      logger,
    );

    await expect(useCase.execute(event({ processingIntent: "capture" }))).resolves.toEqual({
      status: "no_reply",
      reason: "capture_only",
    });
    expect(saved).toHaveLength(1);
    expect(calls).toEqual([]);
  });

  it("returns no_reply for empty Think responses", async () => {
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: " " };
        },
      } satisfies ThinkSessionPort,
      history([]),
      logger,
    );

    await expect(useCase.execute(event({ processingIntent: "invoke" }))).resolves.toEqual({
      status: "no_reply",
      reason: "empty_agent_reply",
    });
  });

  it("does not invoke Think for duplicate invoke events", async () => {
    const calls: Array<{ sessionId: string; event: SlackWorkerRequest }> = [];
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage(input) {
          calls.push(input);
          return { text: "Should not be called" };
        },
      } satisfies ThinkSessionPort,
      duplicateHistory(),
      logger,
    );

    await expect(useCase.execute(event({ processingIntent: "invoke" }))).resolves.toEqual({
      status: "no_reply",
      reason: "duplicate_message",
    });
    expect(calls).toEqual([]);
  });

  it("does not queue skill reflection for capture, duplicate, or empty replies", async () => {
    const queued: Array<{ event: SlackWorkerRequest; assistantReply: string }> = [];

    await new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: "Should not be called" };
        },
      } satisfies ThinkSessionPort,
      history([]),
      logger,
      queue(queued),
    ).execute(event({ processingIntent: "capture" }));

    await new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: "Should not be called" };
        },
      } satisfies ThinkSessionPort,
      duplicateHistory(),
      logger,
      queue(queued),
    ).execute(event({ processingIntent: "invoke" }));

    await new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: " " };
        },
      } satisfies ThinkSessionPort,
      history([]),
      logger,
      queue(queued),
    ).execute(event({ processingIntent: "invoke" }));

    expect(queued).toEqual([]);
  });
});

const logger: LoggerPort = {
  info() {},
  warn() {},
  error() {},
};

function history(saved: SlackWorkerRequest[]): SlackMessageHistoryPort {
  return {
    async saveMessage(event) {
      saved.push(event);
      return { status: "inserted" };
    },
    async findMessagesByChannelAndTimeRange() {
      return [];
    },
    async findMessagesByThreadAndTimeRange() {
      return [];
    },
    async findThreadMessagesByChannelAndTimeRange() {
      return [];
    },
  };
}

function duplicateHistory(): SlackMessageHistoryPort {
  return {
    async saveMessage() {
      return { status: "duplicate" };
    },
    async findMessagesByChannelAndTimeRange() {
      return [];
    },
    async findMessagesByThreadAndTimeRange() {
      return [];
    },
    async findThreadMessagesByChannelAndTimeRange() {
      return [];
    },
  };
}

function queue(
  queued: Array<{ event: SlackWorkerRequest; assistantReply: string }>,
): SkillReflectionQueuePort {
  return {
    async enqueue(input) {
      queued.push(input);
    },
  };
}

function failingQueue(): SkillReflectionQueuePort {
  return {
    async enqueue() {
      throw new Error("Queue unavailable");
    },
  };
}

function event(overrides: Partial<SlackWorkerRequest> = {}): SlackWorkerRequest {
  return {
    source: "slack",
    teamId: "T123",
    channelId: "C123",
    userId: "U123",
    text: "hello",
    messageTs: "1710000000.000200",
    channelType: "channel",
    isMention: false,
    isThreadMessage: false,
    idempotencyKey: "Ev123",
    processingIntent: "invoke",
    ...overrides,
  };
}
