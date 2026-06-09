import type { NormalizedSlackMessageEvent } from "../modules/slack-listener/slack-listener.types.js";

export interface WorkerEventClientPort {
  sendSlackMessageEvent(event: NormalizedSlackMessageEvent): Promise<void>;
}
