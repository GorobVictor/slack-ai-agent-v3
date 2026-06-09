import type {
  SlackEventFilterDecision,
  SlackEventFilterInput,
} from "./slack-listener.types.js";

export function decideSlackEventHandling(input: SlackEventFilterInput): SlackEventFilterDecision {
  const { event, eventType, hasTrackedThread } = input;

  if (eventType === "app_mention") {
    return {
      action: "forward",
      processingIntent: "invoke",
      shouldTrackThread: true,
      reason: "app_mention",
    };
  }

  if (eventType === "message.im") {
    return {
      action: "forward",
      processingIntent: "invoke",
      shouldTrackThread: false,
      reason: "direct_message",
    };
  }

  if (eventType === "message.mpim") {
    return {
      action: "forward",
      processingIntent: event.isMention ? "invoke" : "capture",
      shouldTrackThread: event.isMention,
      reason: event.isMention
        ? "mpim_mention"
        : hasTrackedThread
          ? "tracked_mpim_thread_capture"
          : "mpim_capture",
    };
  }

  if (eventType === "message.channels" || eventType === "message.groups") {
    if (event.isMention) {
      return {
        action: "forward",
        processingIntent: "invoke",
        shouldTrackThread: true,
        reason: "channel_mention",
      };
    }

    if (event.isThreadMessage && hasTrackedThread) {
      return {
        action: "forward",
        processingIntent: "capture",
        shouldTrackThread: false,
        reason: "tracked_thread_capture",
      };
    }

    return {
      action: "forward",
      processingIntent: "capture",
      shouldTrackThread: false,
      reason: event.isThreadMessage ? "thread_capture" : "channel_capture",
    };
  }

  return {
    action: "ignore",
    shouldTrackThread: false,
    reason: "not_relevant",
  };
}
