export type SlackChannelType = "im" | "channel" | "group" | "mpim" | string;

export type NormalizedSlackMessageEvent = {
  source: "slack";
  teamId: string;
  channelId: string;
  userId: string;
  text: string;
  messageTs: string;
  threadTs?: string;
  eventId?: string;
  eventTs?: string;
  clientMsgId?: string;
  channelType?: SlackChannelType;
  isMention: boolean;
  isThreadMessage: boolean;
  idempotencyKey: string;
};

export type SlackEventKind =
  | "app_mention"
  | "message.channels"
  | "message.groups"
  | "message.im"
  | "message.mpim";

export type SlackRawEventEnvelope = {
  event: unknown;
  body?: unknown;
};

export type SlackMessageMetadata = {
  eventType: SlackEventKind;
  hasFilesOrAttachments: boolean;
  threadId: string;
};

export type NormalizedSlackMessage = {
  event: NormalizedSlackMessageEvent;
  metadata: SlackMessageMetadata;
};

export type SlackEventFilterInput = {
  event: NormalizedSlackMessageEvent;
  eventType: SlackEventKind;
  hasTrackedThread: boolean;
};

export type SlackEventFilterDecision =
  | {
      action: "forward";
      shouldTrackThread: boolean;
      reason: string;
    }
  | {
      action: "ignore";
      shouldTrackThread: false;
      reason: string;
    };
