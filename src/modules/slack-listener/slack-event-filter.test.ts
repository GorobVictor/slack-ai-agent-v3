import { describe, expect, it } from "vitest";

import { decideSlackEventHandling } from "./slack-event-filter.js";
import type { NormalizedSlackMessageEvent, SlackEventKind } from "./slack-listener.types.js";

describe("decideSlackEventHandling", () => {
  it("always forwards app mentions and tracks their thread", () => {
    expect(decide("app_mention", { isMention: true })).toMatchObject({
      action: "forward",
      processingIntent: "invoke",
      shouldTrackThread: true,
      reason: "app_mention",
    });
  });

  it("forwards direct messages without requiring a mention", () => {
    expect(decide("message.im", { isMention: false })).toMatchObject({
      action: "forward",
      processingIntent: "invoke",
      shouldTrackThread: false,
      reason: "direct_message",
    });
  });

  it("forwards unmentioned channel root messages as capture-only", () => {
    expect(decide("message.channels", { isMention: false })).toMatchObject({
      action: "forward",
      processingIntent: "capture",
      shouldTrackThread: false,
      reason: "channel_capture",
    });
  });

  it("forwards and tracks channel messages that mention the bot", () => {
    expect(decide("message.channels", { isMention: true })).toMatchObject({
      action: "forward",
      processingIntent: "invoke",
      shouldTrackThread: true,
      reason: "channel_mention",
    });
  });

  it("forwards tracked channel replies as capture-only", () => {
    expect(
      decide("message.groups", { isMention: false, isThreadMessage: true }, true),
    ).toMatchObject({
      action: "forward",
      processingIntent: "capture",
      shouldTrackThread: false,
      reason: "tracked_thread_capture",
    });
  });

  it("forwards mpim conversations as capture-only unless mentioned", () => {
    expect(decide("message.mpim", { isMention: false })).toMatchObject({
      action: "forward",
      processingIntent: "capture",
      shouldTrackThread: false,
      reason: "mpim_capture",
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
