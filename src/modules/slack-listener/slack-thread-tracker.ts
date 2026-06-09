import type { TrackedThreadStorePort } from "../../ports/tracked-thread-store.port.js";
import type { NormalizedSlackMessageEvent } from "./slack-listener.types.js";

export type SlackThreadReference = {
  teamId: string;
  channelId: string;
  threadTs: string;
};

export class SlackThreadTracker {
  constructor(private readonly store: TrackedThreadStorePort) {}

  async hasThread(reference: SlackThreadReference): Promise<boolean> {
    return this.store.hasThread(buildSlackThreadKey(reference));
  }

  async addThread(reference: SlackThreadReference): Promise<void> {
    await this.store.addThread(buildSlackThreadKey(reference));
  }
}

export function buildSlackThreadReference(event: NormalizedSlackMessageEvent): SlackThreadReference {
  return {
    teamId: event.teamId,
    channelId: event.channelId,
    threadTs: event.threadTs ?? event.messageTs,
  };
}

export function buildSlackThreadKey(reference: SlackThreadReference): string {
  return `${reference.teamId}:${reference.channelId}:${reference.threadTs}`;
}
