import { describe, expect, it } from "vitest";

import { D1SlackMessageHistoryAdapter } from "./d1-slack-message-history.adapter.js";
import type { SlackWorkerRequest } from "../../modules/slack/slack.types.js";

describe("D1SlackMessageHistoryAdapter", () => {
  it("reports inserted and duplicate saves from D1 changes", async () => {
    const db = fakeD1([1, 0]);
    const adapter = new D1SlackMessageHistoryAdapter(db);

    await expect(adapter.saveMessage(event())).resolves.toEqual({ status: "inserted" });
    await expect(adapter.saveMessage(event())).resolves.toEqual({ status: "duplicate" });
  });
});

function fakeD1(changes: number[]): D1Database {
  return {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              return { meta: { changes: changes.shift() ?? 0 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
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
    processingIntent: "capture",
    ...overrides,
  };
}
