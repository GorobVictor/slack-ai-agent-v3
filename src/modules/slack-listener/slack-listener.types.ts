import type {
  NormalizedSlackMessageEvent,
  SlackChannelType,
  SlackProcessingIntent,
} from "../slack/slack.types.js";

export type { NormalizedSlackMessageEvent, SlackChannelType, SlackProcessingIntent };

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
      processingIntent: SlackProcessingIntent;
      shouldTrackThread: boolean;
      reason: string;
    }
  | {
      action: "ignore";
      processingIntent?: never;
      shouldTrackThread: false;
      reason: string;
    };
