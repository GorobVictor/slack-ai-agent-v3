import { describe, expect, it } from "vitest";

import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import { readSlackHistoryContextForTool } from "./agent.tools.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";

describe("agent tools", () => {
  it("returns a safe message when Slack history is requested outside a Slack turn", async () => {
    await expect(
      readSlackHistoryContextForTool(
        {
          scope: "thread",
          days: 1,
        },
        {
          history: historyPort(),
          getActiveSlackEvent: () => null,
        },
      ),
    ).resolves.toBe("Slack history context is only available while processing a Slack message.");
  });

  it("reads Slack history through the injected history port", async () => {
    const calls: string[] = [];

    await expect(
      readSlackHistoryContextForTool(
        {
          scope: "thread",
          days: 1,
        },
        {
          history: historyPort(calls),
          getActiveSlackEvent: () => slackEvent(),
        },
      ),
    ).resolves.toBe("[1710000000.000200 thread:1710000000.000100] <@U123>: captured reply");

    expect(calls).toEqual(["thread"]);
  });
});

function historyPort(calls: string[] = []): SlackMessageHistoryPort {
  return {
    async saveMessage() {
      return { status: "inserted" };
    },
    async findMessagesByChannelAndTimeRange() {
      calls.push("channel");
      return [];
    },
    async findMessagesByThreadAndTimeRange() {
      calls.push("thread");
      return [
        {
          teamId: "T123",
          channelId: "C123",
          userId: "U123",
          messageTs: "1710000000.000200",
          threadTs: "1710000000.000100",
          text: "captured reply",
          channelType: "channel",
          isMention: false,
          isThreadMessage: true,
          processingIntent: "capture",
        },
      ];
    },
    async findThreadMessagesByChannelAndTimeRange() {
      calls.push("channel_threads");
      return [];
    },
  };
}

function slackEvent(): SlackWorkerRequest {
  return {
    source: "slack",
    teamId: "T123",
    channelId: "C123",
    userId: "U123",
    text: "summarize this thread",
    messageTs: "1710000000.000100",
    channelType: "channel",
    isMention: true,
    isThreadMessage: false,
    idempotencyKey: "slack:T123:C123:1710000000.000100",
    processingIntent: "invoke",
  };
}
