import type { NormalizedSlackMessageEvent } from "../modules/slack/slack.types.js";

export type SubmitSlackMessageToThinkInput = {
  sessionId: string;
  event: NormalizedSlackMessageEvent;
};

export type ThinkSessionReply = {
  text: string;
};

export interface ThinkSessionPort {
  submitSlackMessage(input: SubmitSlackMessageToThinkInput): Promise<ThinkSessionReply>;
}
