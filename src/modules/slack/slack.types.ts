export type SlackChannelType = "im" | "channel" | "group" | "mpim" | string;
export type SlackProcessingIntent = "capture" | "invoke";

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
  processingIntent?: SlackProcessingIntent;
};

export type SlackReplyTarget = {
  channelId: string;
  threadTs: string;
};

export type WorkerSlackReplyResponse =
  | {
      status: "reply";
      text: string;
      threadTs?: string;
    }
  | {
      status: "no_reply";
      reason?: string;
    }
  | {
      status: "error";
      code: string;
      message: string;
    };

export type SlackWorkerRequest = NormalizedSlackMessageEvent & {
  processingIntent: SlackProcessingIntent;
};
