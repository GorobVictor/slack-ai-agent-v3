import type { NormalizedSlackMessageEvent } from "./slack.types.js";

export function resolveSlackSessionId(event: NormalizedSlackMessageEvent): string {
  if (event.channelType === "im") {
    return `slack:${event.teamId}:dm:${event.userId}`;
  }

  const threadId = event.threadTs ?? event.messageTs;

  return `slack:${event.teamId}:channel:${event.channelId}:thread:${threadId}`;
}
