import type {
  NormalizedSlackMessage,
  SlackChannelType,
  SlackEventKind,
  SlackRawEventEnvelope,
} from "./slack-listener.types.js";

type SlackEventRecord = Record<string, unknown>;

const SUPPORTED_MESSAGE_CHANNEL_TYPES = new Set(["channel", "group", "im", "mpim"]);
const ALLOWED_MESSAGE_SUBTYPES = new Set(["file_share", "thread_broadcast"]);
const IGNORED_MESSAGE_SUBTYPES = new Set(["message_changed", "message_deleted"]);

export function normalizeSlackMessageEvent(
  rawEvent: unknown,
  botUserId: string,
): NormalizedSlackMessage | null {
  const { event, body } = unwrapRawEvent(rawEvent);

  if (!isRecord(event)) {
    return null;
  }

  const eventType = resolveEventType(event);

  if (!eventType || shouldIgnoreEvent(event, botUserId)) {
    return null;
  }

  const teamId = readString(event.team) ?? readString(event.team_id) ?? readString(body?.team_id);
  const channelId = readString(event.channel);
  const userId = readString(event.user);
  const text = readString(event.text) ?? "";
  const messageTs = readString(event.ts);
  const threadTs = readString(event.thread_ts);
  const eventId = readString(body?.event_id) ?? readString(event.event_id);
  const eventTs = readString(event.event_ts) ?? readStringOrNumber(body?.event_time);
  const clientMsgId = readString(event.client_msg_id);
  const channelType = resolveChannelType(event);
  const hasFilesOrAttachments = hasNonEmptyArray(event.files) || hasNonEmptyArray(event.attachments);

  if (!teamId || !channelId || !userId || !messageTs) {
    return null;
  }

  if (!text.trim() && !hasFilesOrAttachments) {
    return null;
  }

  const idempotencyKey = clientMsgId ?? `slack:${teamId}:${channelId}:${messageTs}`;

  return {
    event: {
      source: "slack",
      teamId,
      channelId,
      userId,
      text,
      messageTs,
      threadTs,
      eventId,
      eventTs,
      clientMsgId,
      channelType,
      isMention: eventType === "app_mention" || text.includes(`<@${botUserId}>`),
      isThreadMessage: Boolean(threadTs),
      idempotencyKey,
    },
    metadata: {
      eventType,
      hasFilesOrAttachments,
      threadId: threadTs ?? messageTs,
    },
  };
}

function unwrapRawEvent(rawEvent: unknown): {
  event: unknown;
  body?: SlackEventRecord;
} {
  if (isRecord(rawEvent) && "event" in rawEvent) {
    const envelope = rawEvent as SlackRawEventEnvelope;
    return {
      event: envelope.event,
      body: isRecord(envelope.body) ? envelope.body : undefined,
    };
  }

  return { event: rawEvent };
}

function resolveEventType(event: SlackEventRecord): SlackEventKind | null {
  const type = readString(event.type);

  if (type === "app_mention") {
    return "app_mention";
  }

  if (type !== "message") {
    return null;
  }

  const channelType = resolveChannelType(event);

  if (!channelType || !SUPPORTED_MESSAGE_CHANNEL_TYPES.has(channelType)) {
    return null;
  }

  return toSlackEventKind(channelType);
}

function shouldIgnoreEvent(event: SlackEventRecord, botUserId: string): boolean {
  const subtype = readString(event.subtype);

  if (readBoolean(event.hidden)) {
    return true;
  }

  if (subtype && (IGNORED_MESSAGE_SUBTYPES.has(subtype) || !ALLOWED_MESSAGE_SUBTYPES.has(subtype))) {
    return true;
  }

  if (!readString(event.user)) {
    return true;
  }

  if (readString(event.user) === botUserId || readString(event.bot_id)) {
    return true;
  }

  return false;
}

function resolveChannelType(event: SlackEventRecord): SlackChannelType | undefined {
  const channelType = readString(event.channel_type);

  if (channelType) {
    return channelType;
  }

  const channelId = readString(event.channel);

  if (channelId?.startsWith("D")) {
    return "im";
  }

  if (channelId?.startsWith("C")) {
    return "channel";
  }

  if (channelId?.startsWith("G")) {
    return "group";
  }

  return undefined;
}

function toSlackEventKind(channelType: SlackChannelType): SlackEventKind {
  switch (channelType) {
    case "channel":
      return "message.channels";
    case "group":
      return "message.groups";
    case "im":
      return "message.im";
    case "mpim":
      return "message.mpim";
    default:
      return `message.${channelType}` as SlackEventKind;
  }
}

function isRecord(value: unknown): value is SlackEventRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readStringOrNumber(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return readString(value);
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
