import type { SlackWorkerRequest } from "../modules/slack/slack.types.js";

export type SaveSlackMessageResult = {
  status: "inserted" | "duplicate";
};

export type SlackHistoryMessage = {
  teamId: string;
  channelId: string;
  userId: string;
  messageTs: string;
  threadTs?: string;
  text: string;
  channelType?: string;
  isMention: boolean;
  isThreadMessage: boolean;
  processingIntent: "capture" | "invoke";
};

export type SlackHistoryTimeRange = {
  teamId: string;
  channelId: string;
  sinceTs: string;
  untilTs: string;
  limit?: number;
};

export type SlackThreadHistoryTimeRange = SlackHistoryTimeRange & {
  threadTs: string;
};

export interface SlackMessageHistoryPort {
  saveMessage(event: SlackWorkerRequest): Promise<SaveSlackMessageResult>;
  findMessagesByChannelAndTimeRange(
    input: SlackHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]>;
  findMessagesByThreadAndTimeRange(
    input: SlackThreadHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]>;
  findThreadMessagesByChannelAndTimeRange(
    input: SlackHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]>;
}
