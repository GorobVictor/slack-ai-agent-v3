import { describe, expect, it } from "vitest";

import { buildSlackAgentSystemPrompt, buildSlackUserMessagePrompt } from "./agent.prompts.js";

describe("agent prompts", () => {
  it("keeps Slack history tool guidance in the system prompt", () => {
    expect(buildSlackAgentSystemPrompt()).toContain("call getSlackHistoryContext first");
  });

  it("formats Slack event metadata before the user message", () => {
    expect(
      buildSlackUserMessagePrompt({
        source: "slack",
        teamId: "T123",
        channelId: "C123",
        userId: "U123",
        text: "summarize this",
        messageTs: "1710000000.000100",
        channelType: "channel",
        isMention: true,
        isThreadMessage: false,
        idempotencyKey: "slack:T123:C123:1710000000.000100",
        processingIntent: "invoke",
      }),
    ).toContain("Message:\nsummarize this");
  });
});
