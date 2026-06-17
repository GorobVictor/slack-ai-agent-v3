import { describe, expect, it } from "vitest";

import {
  buildSlackHistoryContextPrompt,
  EMPTY_SLACK_HISTORY_CONTEXT_PROMPT,
} from "./slack-history.prompts.js";

describe("slack history prompts", () => {
  it("formats Slack history messages for model context", () => {
    expect(
      buildSlackHistoryContextPrompt([
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
      ]),
    ).toBe("[1710000000.000200 thread:1710000000.000100] <@U123>: captured reply");
  });

  it("exports the empty history context text", () => {
    expect(EMPTY_SLACK_HISTORY_CONTEXT_PROMPT).toContain("No Slack history");
  });
});
