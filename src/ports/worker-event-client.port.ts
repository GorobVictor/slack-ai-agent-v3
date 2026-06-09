import type {
  NormalizedSlackMessageEvent,
  WorkerSlackReplyResponse,
} from "../modules/slack/slack.types.js";

export interface WorkerEventClientPort {
  sendSlackMessageEvent(event: NormalizedSlackMessageEvent): Promise<WorkerSlackReplyResponse>;
}
