import type {
  SaveSlackMessageResult,
  SlackHistoryMessage,
  SlackHistoryTimeRange,
  SlackMessageHistoryPort,
  SlackThreadHistoryTimeRange,
} from "../../ports/slack-message-history.port.js";
import type { SlackWorkerRequest } from "../../modules/slack/slack.types.js";

const DEFAULT_HISTORY_LIMIT = 500;

type SlackMessageRow = {
  team_id: string;
  channel_id: string;
  user_id: string;
  message_ts: string;
  thread_ts: string | null;
  text: string;
  channel_type: string | null;
  is_mention: number;
  is_thread_message: number;
  processing_intent: "capture" | "invoke";
};

export class D1SlackMessageHistoryAdapter implements SlackMessageHistoryPort {
  constructor(private readonly db: D1Database) {}

  async saveMessage(event: SlackWorkerRequest): Promise<SaveSlackMessageResult> {
    const result = await this.db
      .prepare(
        `
          INSERT OR IGNORE INTO slack_messages (
            idempotency_key,
            team_id,
            channel_id,
            user_id,
            message_ts,
            thread_ts,
            text,
            channel_type,
            is_mention,
            is_thread_message,
            processing_intent,
            event_id,
            event_ts,
            client_msg_id,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        event.idempotencyKey,
        event.teamId,
        event.channelId,
        event.userId,
        event.messageTs,
        event.threadTs ?? null,
        event.text,
        event.channelType ?? null,
        event.isMention ? 1 : 0,
        event.isThreadMessage ? 1 : 0,
        event.processingIntent,
        event.eventId ?? null,
        event.eventTs ?? null,
        event.clientMsgId ?? null,
        Date.now(),
      )
      .run();

    return {
      status: result.meta.changes > 0 ? "inserted" : "duplicate",
    };
  }

  async findMessagesByChannelAndTimeRange(
    input: SlackHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]> {
    const result = await this.db
      .prepare(
        `
          SELECT team_id, channel_id, user_id, message_ts, thread_ts, text,
            channel_type, is_mention, is_thread_message, processing_intent
          FROM slack_messages
          WHERE team_id = ?
            AND channel_id = ?
            AND thread_ts IS NULL
            AND message_ts >= ?
            AND message_ts <= ?
          ORDER BY message_ts ASC
          LIMIT ?
        `,
      )
      .bind(
        input.teamId,
        input.channelId,
        input.sinceTs,
        input.untilTs,
        readLimit(input.limit),
      )
      .all<SlackMessageRow>();

    return result.results.map(mapRow);
  }

  async findMessagesByThreadAndTimeRange(
    input: SlackThreadHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]> {
    const result = await this.db
      .prepare(
        `
          SELECT team_id, channel_id, user_id, message_ts, thread_ts, text,
            channel_type, is_mention, is_thread_message, processing_intent
          FROM slack_messages
          WHERE team_id = ?
            AND channel_id = ?
            AND COALESCE(thread_ts, message_ts) = ?
            AND message_ts >= ?
            AND message_ts <= ?
          ORDER BY message_ts ASC
          LIMIT ?
        `,
      )
      .bind(
        input.teamId,
        input.channelId,
        input.threadTs,
        input.sinceTs,
        input.untilTs,
        readLimit(input.limit),
      )
      .all<SlackMessageRow>();

    return result.results.map(mapRow);
  }

  async findThreadMessagesByChannelAndTimeRange(
    input: SlackHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]> {
    const result = await this.db
      .prepare(
        `
          SELECT team_id, channel_id, user_id, message_ts, thread_ts, text,
            channel_type, is_mention, is_thread_message, processing_intent
          FROM slack_messages
          WHERE team_id = ?
            AND channel_id = ?
            AND thread_ts IS NOT NULL
            AND message_ts >= ?
            AND message_ts <= ?
          ORDER BY thread_ts ASC, message_ts ASC
          LIMIT ?
        `,
      )
      .bind(
        input.teamId,
        input.channelId,
        input.sinceTs,
        input.untilTs,
        readLimit(input.limit),
      )
      .all<SlackMessageRow>();

    return result.results.map(mapRow);
  }
}

function readLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(limit ?? DEFAULT_HISTORY_LIMIT, 1_000));
}

function mapRow(row: SlackMessageRow): SlackHistoryMessage {
  return {
    teamId: row.team_id,
    channelId: row.channel_id,
    userId: row.user_id,
    messageTs: row.message_ts,
    threadTs: row.thread_ts ?? undefined,
    text: row.text,
    channelType: row.channel_type ?? undefined,
    isMention: Boolean(row.is_mention),
    isThreadMessage: Boolean(row.is_thread_message),
    processingIntent: row.processing_intent,
  };
}
