import type { LoggerPort } from "../../ports/logger.port.js";
import type { SlackMessengerPort } from "../../ports/slack-messenger.port.js";
import type { TrackedThreadStorePort } from "../../ports/tracked-thread-store.port.js";
import type { WorkerEventClientPort } from "../../ports/worker-event-client.port.js";
import { decideSlackEventHandling } from "./slack-event-filter.js";
import { normalizeSlackMessageEvent } from "./slack-event-normalizer.js";
import {
  buildSlackThreadReference,
  SlackThreadTracker,
} from "./slack-thread-tracker.js";
import type { NormalizedSlackMessageEvent } from "./slack-listener.types.js";

export class SlackListenerUseCase {
  private readonly threadTracker: SlackThreadTracker;

  constructor(
    private readonly workerClient: WorkerEventClientPort,
    private readonly slackMessenger: SlackMessengerPort,
    trackedThreads: TrackedThreadStorePort,
    private readonly logger: LoggerPort,
    private readonly botUserId: string,
  ) {
    this.threadTracker = new SlackThreadTracker(trackedThreads);
  }

  async handleRawSlackEvent(rawEvent: unknown): Promise<void> {
    const normalized = normalizeSlackMessageEvent(rawEvent, this.botUserId);

    if (!normalized) {
      this.logger.info("Ignored unsupported or invalid Slack event");
      return;
    }

    const { event, metadata } = normalized;
    const safeMetadata = buildSafeLogMetadata(event);

    try {
      const threadReference = buildSlackThreadReference(event);
      const hasTrackedThread = event.isThreadMessage
        ? await this.threadTracker.hasThread(threadReference)
        : false;
      const decision = decideSlackEventHandling({
        event,
        eventType: metadata.eventType,
        hasTrackedThread,
      });

      if (decision.action === "ignore") {
        this.logger.info("Ignored Slack event", {
          ...safeMetadata,
          reason: decision.reason,
        });
        return;
      }

      if (decision.shouldTrackThread) {
        await this.threadTracker.addThread(threadReference);
      }

      const workerReply = await this.workerClient.sendSlackMessageEvent(event);

      if (workerReply.status === "reply") {
        await this.slackMessenger.sendMessage({
          channelId: event.channelId,
          threadTs: workerReply.threadTs ?? event.threadTs ?? event.messageTs,
          text: workerReply.text,
        });
      }

      this.logger.info("Forwarded Slack event to Worker", {
        ...safeMetadata,
        reason: decision.reason,
        workerReplyStatus: workerReply.status,
        trackedThread: decision.shouldTrackThread,
      });
    } catch (error) {
      this.logger.error("Failed to process Slack event", {
        ...safeMetadata,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

function buildSafeLogMetadata(event: NormalizedSlackMessageEvent): Record<string, unknown> {
  return {
    teamId: event.teamId,
    channelId: event.channelId,
    threadTs: event.threadTs,
    messageTs: event.messageTs,
    eventId: event.eventId,
    channelType: event.channelType,
    isMention: event.isMention,
    isThreadMessage: event.isThreadMessage,
  };
}
