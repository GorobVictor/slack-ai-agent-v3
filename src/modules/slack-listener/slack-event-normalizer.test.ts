import { describe, expect, it } from "vitest";

import { normalizeSlackMessageEvent } from "./slack-event-normalizer.js";

const BOT_USER_ID = "UBOT";

describe("normalizeSlackMessageEvent", () => {
  it("normalizes app mentions and uses event_id as the idempotency key", () => {
    const normalized = normalizeSlackMessageEvent(
      {
        body: {
          event_id: "Ev123",
          team_id: "T123",
        },
        event: {
          type: "app_mention",
          channel: "C123",
          user: "U123",
          text: "<@UBOT> hello",
          ts: "1710000000.000100",
        },
      },
      BOT_USER_ID,
    );

    expect(normalized?.event).toMatchObject({
      source: "slack",
      teamId: "T123",
      channelId: "C123",
      userId: "U123",
      text: "<@UBOT> hello",
      messageTs: "1710000000.000100",
      channelType: "channel",
      isMention: true,
      isThreadMessage: false,
      idempotencyKey: "Ev123",
    });
    expect(normalized?.metadata.eventType).toBe("app_mention");
    expect(normalized?.metadata.threadId).toBe("1710000000.000100");
  });

  it("normalizes direct message thread replies", () => {
    const normalized = normalizeSlackMessageEvent(
      {
        event: {
          type: "message",
          team: "T123",
          channel: "D123",
          channel_type: "im",
          user: "U123",
          text: "thread reply",
          ts: "1710000000.000200",
          thread_ts: "1710000000.000100",
          client_msg_id: "client-123",
        },
      },
      BOT_USER_ID,
    );

    expect(normalized?.event).toMatchObject({
      channelType: "im",
      threadTs: "1710000000.000100",
      isMention: false,
      isThreadMessage: true,
      idempotencyKey: "client-123",
    });
    expect(normalized?.metadata.eventType).toBe("message.im");
  });

  it("ignores bot, hidden, unsupported subtype, and empty text events without files", () => {
    const baseEvent = {
      type: "message",
      team: "T123",
      channel: "C123",
      channel_type: "channel",
      user: "U123",
      text: "hello",
      ts: "1710000000.000100",
    };

    expect(
      normalizeSlackMessageEvent({ event: { ...baseEvent, user: BOT_USER_ID } }, BOT_USER_ID),
    ).toBeNull();
    expect(normalizeSlackMessageEvent({ event: { ...baseEvent, hidden: true } }, BOT_USER_ID)).toBeNull();
    expect(
      normalizeSlackMessageEvent({ event: { ...baseEvent, subtype: "message_changed" } }, BOT_USER_ID),
    ).toBeNull();
    expect(normalizeSlackMessageEvent({ event: { ...baseEvent, text: "" } }, BOT_USER_ID)).toBeNull();
  });

  it("keeps file share events with empty text because they carry attachments", () => {
    const normalized = normalizeSlackMessageEvent(
      {
        body: {
          team_id: "T123",
          event_time: 1710000000,
        },
        event: {
          type: "message",
          channel: "C123",
          channel_type: "channel",
          user: "U123",
          text: "",
          ts: "1710000000.000100",
          subtype: "file_share",
          files: [{ id: "F123" }],
        },
      },
      BOT_USER_ID,
    );

    expect(normalized?.event.idempotencyKey).toBe("1710000000");
    expect(normalized?.metadata.hasFilesOrAttachments).toBe(true);
  });
});
