import { describe, expect, it } from "vitest";

import { normalizeSlackMessageEvent } from "../../modules/slack-listener/slack-event-normalizer.js";
import { buildSafeSlackRawEventEnvelope } from "./slack-socket-mode.adapter.js";

describe("buildSafeSlackRawEventEnvelope", () => {
  it("keeps only the Slack body fields needed for normalization", () => {
    const safeEnvelope = buildSafeSlackRawEventEnvelope({
      body: {
        event_id: "Ev123",
        event_time: 1710000000,
        team_id: "T123",
        token: "verification-token",
        authorizations: [{ user_id: "UBOT" }],
        event: {
          text: "full duplicated event body",
        },
      },
      event: {
        type: "app_mention",
        channel: "C123",
        user: "U123",
        text: "<@UBOT> hello",
        ts: "1710000000.000100",
      },
    });

    expect(safeEnvelope.body).toEqual({
      event_id: "Ev123",
      event_time: 1710000000,
      team_id: "T123",
    });
    expect(JSON.stringify(safeEnvelope.body)).not.toContain("verification-token");
    expect(JSON.stringify(safeEnvelope.body)).not.toContain("authorizations");

    const normalized = normalizeSlackMessageEvent(safeEnvelope, "UBOT");

    expect(normalized?.event).toMatchObject({
      teamId: "T123",
      eventId: "Ev123",
      eventTs: "1710000000",
      channelId: "C123",
      messageTs: "1710000000.000100",
    });
  });
});
