import { describe, expect, it } from "vitest";

import type { LoggerPort } from "../../ports/logger.port.js";
import { HandleSlackMessageUseCase } from "./handle-slack-message.use-case.js";
import { handleSlackEventRequest } from "./slack.handler.js";
import type { NormalizedSlackMessageEvent } from "./slack.types.js";

describe("handleSlackEventRequest", () => {
  it("rejects missing authorization", async () => {
    const response = await handleSlackEventRequest(request(event()), options());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      code: "UNAUTHORIZED",
    });
  });

  it("rejects invalid payloads", async () => {
    const response = await handleSlackEventRequest(
      request({ source: "slack" }, "secret"),
      options(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      code: "SLACK_EVENT_INVALID",
    });
  });

  it("returns Worker reply responses", async () => {
    const response = await handleSlackEventRequest(request(event(), "secret"), options());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "reply",
      text: "Hello from Think",
      threadTs: "1710000000.000200",
    });
  });
});

function options() {
  return {
    internalApiToken: "secret",
    useCase: new HandleSlackMessageUseCase(
      {
        async submitSlackMessage() {
          return { text: "Hello from Think" };
        },
      },
      logger,
    ),
    logger,
  };
}

function request(body: unknown, token?: string): Request {
  return new Request("https://worker.example/slack/events", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(body),
  });
}

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
