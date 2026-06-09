import { describe, expect, it } from "vitest";

import type { LoggerPort } from "../../ports/logger.port.js";
import type { ThinkSessionPort } from "../../ports/think-session.port.js";
import { HandleSlackMessageUseCase } from "./handle-slack-message.use-case.js";
import type { NormalizedSlackMessageEvent } from "./slack.types.js";

describe("HandleSlackMessageUseCase", () => {
  it("submits Slack messages to a resolved Think session", async () => {
    const calls: Array<{ sessionId: string; event: NormalizedSlackMessageEvent }> = [];
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage(input) {
          calls.push(input);
          return { text: "Hello from Think" };
        },
      } satisfies ThinkSessionPort,
      logger,
    );

    await expect(useCase.execute(event({ threadTs: "1710000000.000100" }))).resolves.toEqual({
      status: "reply",
      text: "Hello from Think",
      threadTs: "1710000000.000100",
    });
    expect(calls[0]?.sessionId).toBe("slack:T123:channel:C123:thread:1710000000.000100");
  });

  it("returns no_reply for empty Think responses", async () => {
    const useCase = new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: " " };
        },
      } satisfies ThinkSessionPort,
      logger,
    );

    await expect(useCase.execute(event())).resolves.toEqual({
      status: "no_reply",
      reason: "empty_agent_reply",
    });
  });
});

const logger: LoggerPort = {
  info() {},
  warn() {},
  error() {},
};

function event(overrides: Partial<NormalizedSlackMessageEvent> = {}): NormalizedSlackMessageEvent {
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
    ...overrides,
  };
}
