import type {
  SlackWorkerRequest,
  WorkerSlackReplyResponse,
} from "../modules/slack/slack.types.js";

export type WorkerSlackMessageStreamCallbacks = {
  onDelta(input: { text: string }): Promise<void> | void;
};

export interface WorkerEventClientPort {
  sendSlackMessageEvent(event: SlackWorkerRequest): Promise<WorkerSlackReplyResponse>;
  streamSlackMessageEvent(
    event: SlackWorkerRequest,
    callbacks: WorkerSlackMessageStreamCallbacks,
  ): Promise<WorkerSlackReplyResponse>;
}
