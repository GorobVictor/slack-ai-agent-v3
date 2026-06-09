import type {
  SlackEventFilterDecision,
  SlackEventFilterInput,
} from "./slack-listener.types.js";

export function decideSlackEventHandling(input: SlackEventFilterInput): SlackEventFilterDecision {
  const { event, eventType, hasTrackedThread } = input;

  if (eventType === "app_mention") {
    return {
      action: "forward",
      shouldTrackThread: true,
      reason: "app_mention",
    };
  }

  if (eventType === "message.im") {
    return {
      action: "forward",
      shouldTrackThread: false,
      reason: "direct_message",
    };
  }

  if (eventType === "message.mpim") {
    return {
      action: "forward",
      shouldTrackThread: event.isMention,
      reason: event.isMention
        ? "mpim_mention"
        : hasTrackedThread
          ? "tracked_mpim_thread"
          : "mpim_conversation",
    };
  }

  if (eventType === "message.channels" || eventType === "message.groups") {
    if (event.isMention) {
      return {
        action: "forward",
        shouldTrackThread: true,
        reason: "channel_mention",
      };
    }

    if (event.isThreadMessage && hasTrackedThread) {
      return {
        action: "forward",
        shouldTrackThread: false,
        reason: "tracked_thread",
      };
    }
  }

  return {
    action: "ignore",
    shouldTrackThread: false,
    reason: "not_relevant",
  };
}
