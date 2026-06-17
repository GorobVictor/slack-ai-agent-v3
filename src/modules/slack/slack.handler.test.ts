import { describe, expect, it } from "vitest";

import type { LoggerPort } from "../../ports/logger.port.js";
import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import { HandleSlackMessageUseCase } from "./handle-slack-message.use-case.js";
import { handleSlackEventRequest } from "./slack.handler.js";
import type { SlackWorkerRequest } from "./slack.types.js";

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

  it("streams Worker reply responses", async () => {
    const response = await handleSlackEventRequest(
      request(event(), "secret", {
        Accept: "application/x-ndjson",
      }),
      options(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/x-ndjson");
    await expect(response.text()).resolves.toBe(
      [
        JSON.stringify({ type: "delta", text: "Hello " }),
        JSON.stringify({ type: "delta", text: "from Think" }),
        JSON.stringify({
          type: "done",
          text: "Hello from Think",
          threadTs: "1710000000.000200",
        }),
        "",
      ].join("\n"),
    );
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
        async streamSlackMessage(_input, callbacks) {
          await callbacks.onTextDelta("Hello ");
          await callbacks.onTextDelta("from Think");
          return { text: "Hello from Think" };
        },
      },
      history(),
      logger,
    ),
    logger,
  };
}

function request(body: unknown, token?: string, headers: Record<string, string> = {}): Request {
  return new Request("https://worker.example/slack/events", {
    method: "POST",
    headers: token
      ? {
          ...headers,
          Authorization: `Bearer ${token}`,
        }
      : headers,
    body: JSON.stringify(body),
  });
}

const logger: LoggerPort = {
  info() {},
  warn() {},
  error() {},
};

function history(): SlackMessageHistoryPort {
  return {
    async saveMessage() {
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
