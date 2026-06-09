import type {
  NormalizedSlackMessageEvent,
  SlackChannelType,
} from "../slack/slack.types.js";

export type { NormalizedSlackMessageEvent, SlackChannelType };

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
