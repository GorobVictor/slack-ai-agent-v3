import type { SlackWorkerRequest } from "../modules/slack/slack.types.js";

export type SubmitSlackMessageToThinkInput = {
  sessionId: string;
  event: SlackWorkerRequest;
};

export type ThinkSessionReply = {
  text: string;
};

export type ThinkSessionStreamCallbacks = {
  onTextDelta(text: string): Promise<void> | void;
};

export interface ThinkSessionPort {
  submitSlackMessage(input: SubmitSlackMessageToThinkInput): Promise<ThinkSessionReply>;
  streamSlackMessage(
    input: SubmitSlackMessageToThinkInput,
    callbacks: ThinkSessionStreamCallbacks,
  ): Promise<ThinkSessionReply>;
}
