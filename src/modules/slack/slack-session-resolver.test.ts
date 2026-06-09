import { describe, expect, it } from "vitest";

import { resolveSlackSessionId } from "./slack-session-resolver.js";
import type { NormalizedSlackMessageEvent } from "./slack.types.js";

describe("resolveSlackSessionId", () => {
  it("uses user scoped sessions for direct messages", () => {
    expect(resolveSlackSessionId(event({ channelType: "im" }))).toBe("slack:T123:dm:U123");
  });

  it("uses thread scoped sessions for channel messages", () => {
    expect(resolveSlackSessionId(event({ threadTs: "1710000000.000100" }))).toBe(
      "slack:T123:channel:C123:thread:1710000000.000100",
    );
  });

  it("uses message timestamp as the root thread id", () => {
    expect(resolveSlackSessionId(event())).toBe(
      "slack:T123:channel:C123:thread:1710000000.000200",
    );
  });
});

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
