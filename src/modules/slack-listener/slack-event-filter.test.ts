import { describe, expect, it } from "vitest";

import { decideSlackEventHandling } from "./slack-event-filter.js";
import type { NormalizedSlackMessageEvent, SlackEventKind } from "./slack-listener.types.js";

describe("decideSlackEventHandling", () => {
  it("always forwards app mentions and tracks their thread", () => {
    expect(decide("app_mention", { isMention: true })).toMatchObject({
      action: "forward",
      shouldTrackThread: true,
      reason: "app_mention",
    });
  });

  it("forwards direct messages without requiring a mention", () => {
    expect(decide("message.im", { isMention: false })).toMatchObject({
      action: "forward",
      shouldTrackThread: false,
      reason: "direct_message",
    });
  });

  it("does not forward unmentioned channel root messages", () => {
    expect(decide("message.channels", { isMention: false })).toMatchObject({
      action: "ignore",
      shouldTrackThread: false,
    });
  });

  it("forwards and tracks channel messages that mention the bot", () => {
    expect(decide("message.channels", { isMention: true })).toMatchObject({
      action: "forward",
      shouldTrackThread: true,
      reason: "channel_mention",
    });
  });

  it("forwards channel replies when the thread is already tracked", () => {
    expect(
      decide("message.groups", { isMention: false, isThreadMessage: true }, true),
    ).toMatchObject({
      action: "forward",
      shouldTrackThread: false,
      reason: "tracked_thread",
    });
  });

  it("forwards mpim conversations as DM-like conversations", () => {
    expect(decide("message.mpim", { isMention: false })).toMatchObject({
      action: "forward",
      shouldTrackThread: false,
      reason: "mpim_conversation",
    });
  });
});

function decide(
  eventType: SlackEventKind,
  overrides: Partial<NormalizedSlackMessageEvent>,
  hasTrackedThread = false,
) {
  return decideSlackEventHandling({
    event: {
      source: "slack",
      teamId: "T123",
      channelId: "C123",
      userId: "U123",
      text: "hello",
      messageTs: "1710000000.000100",
      channelType: "channel",
      isMention: false,
      isThreadMessage: false,
      idempotencyKey: "Ev123",
      ...overrides,
    },
    eventType,
    hasTrackedThread,
  });
}
