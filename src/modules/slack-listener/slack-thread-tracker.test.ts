import { describe, expect, it } from "vitest";

import { InMemoryTrackedThreadStoreAdapter } from "../../adapters/storage/in-memory-tracked-thread-store.adapter.js";
import {
  buildSlackThreadKey,
  buildSlackThreadReference,
  SlackThreadTracker,
} from "./slack-thread-tracker.js";
import type { NormalizedSlackMessageEvent } from "./slack-listener.types.js";

describe("SlackThreadTracker", () => {
  it("builds stable thread keys", () => {
    expect(
      buildSlackThreadKey({
        teamId: "T123",
        channelId: "C123",
        threadTs: "1710000000.000100",
      }),
    ).toBe("T123:C123:1710000000.000100");
  });

  it("uses thread_ts when available and message_ts for root messages", () => {
    expect(buildSlackThreadReference(event({ threadTs: "1710000000.000100" })).threadTs).toBe(
      "1710000000.000100",
    );
    expect(buildSlackThreadReference(event()).threadTs).toBe("1710000000.000200");
  });

  it("tracks threads through the configured store", async () => {
    const tracker = new SlackThreadTracker(new InMemoryTrackedThreadStoreAdapter());
    const reference = {
      teamId: "T123",
      channelId: "C123",
      threadTs: "1710000000.000100",
    };

    await expect(tracker.hasThread(reference)).resolves.toBe(false);
    await tracker.addThread(reference);
    await expect(tracker.hasThread(reference)).resolves.toBe(true);
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
    isThreadMessage: Boolean(overrides.threadTs),
    idempotencyKey: "Ev123",
    ...overrides,
  };
}
