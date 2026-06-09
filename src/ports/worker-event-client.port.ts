import type {
  SlackWorkerRequest,
  WorkerSlackReplyResponse,
} from "../modules/slack/slack.types.js";

export interface WorkerEventClientPort {
  sendSlackMessageEvent(event: SlackWorkerRequest): Promise<WorkerSlackReplyResponse>;
}
