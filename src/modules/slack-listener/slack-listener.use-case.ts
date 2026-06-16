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
import { retry } from "../../tools/retry.tool.js";

const FALLBACK_REPLY_TEXT =
  "Something went wrong while processing your request. Please try again.";

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

      const workerEvent = {
        ...event,
        processingIntent: decision.processingIntent,
      };
      const workerReply = await this.sendWorkerEventWithFallback(workerEvent);

      if (!workerReply) {
        return;
      }

      if (workerReply.status === "error") {
        await this.sendFallbackReply(event);
        return;
      }

      if (workerReply.status === "reply") {
        const replyThreadTs = workerReply.threadTs ?? event.threadTs ?? event.messageTs;
        const postedMessage = await this.sendSlackMessageWithRetry({
          channelId: event.channelId,
          threadTs: replyThreadTs,
          text: workerReply.text,
        });
        await this.workerClient.sendSlackMessageEvent({
          source: "slack",
          teamId: event.teamId,
          channelId: event.channelId,
          userId: this.botUserId,
          text: workerReply.text,
          messageTs: postedMessage.messageTs,
          threadTs: replyThreadTs,
          channelType: event.channelType,
          isMention: false,
          isThreadMessage: true,
          idempotencyKey: `slack:${event.teamId}:${event.channelId}:${postedMessage.messageTs}`,
          processingIntent: "capture",
        });
      }

      this.logger.info("Forwarded Slack event to Worker", {
        ...safeMetadata,
        reason: decision.reason,
        processingIntent: decision.processingIntent,
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

  private async sendWorkerEventWithFallback(
    event: NormalizedSlackMessageEvent & { processingIntent: "capture" | "invoke" },
  ) {
    try {
      return await this.workerClient.sendSlackMessageEvent(event);
    } catch (error) {
      this.logger.error("Failed to forward Slack event to Worker", {
        ...buildSafeLogMetadata(event),
        processingIntent: event.processingIntent,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (event.processingIntent === "invoke") {
        await this.sendFallbackReply(event);
      }

      return null;
    }
  }

  private async sendFallbackReply(event: NormalizedSlackMessageEvent): Promise<void> {
    try {
      await this.sendSlackMessageWithRetry({
        channelId: event.channelId,
        threadTs: event.threadTs ?? event.messageTs,
        text: FALLBACK_REPLY_TEXT,
      });
    } catch (error) {
      this.logger.error("Failed to send fallback Slack reply", {
        ...buildSafeLogMetadata(event),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async sendSlackMessageWithRetry(input: {
    channelId: string;
    threadTs: string;
    text: string;
  }) {
    return retry(() => this.slackMessenger.sendMessage(input), {
      attempts: 3,
      initialDelayMs: 1_000,
      maxDelayMs: 1_000,
      factor: 1,
    });
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
