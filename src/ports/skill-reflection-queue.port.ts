import type { SlackWorkerRequest } from "../modules/slack/slack.types.js";

export type EnqueueSkillReflectionInput = {
  event: SlackWorkerRequest;
  assistantReply: string;
};

export interface SkillReflectionQueuePort {
  enqueue(input: EnqueueSkillReflectionInput): Promise<void>;
}
