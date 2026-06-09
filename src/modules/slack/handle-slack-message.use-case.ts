import type { LoggerPort } from "../../ports/logger.port.js";
import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import type { ThinkSessionPort } from "../../ports/think-session.port.js";
import { resolveSlackSessionId } from "./slack-session-resolver.js";
import type {
  SlackWorkerRequest,
  WorkerSlackReplyResponse,
} from "./slack.types.js";

export class HandleSlackMessageUseCase {
  constructor(
    private readonly thinkSession: ThinkSessionPort,
    private readonly history: SlackMessageHistoryPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(event: SlackWorkerRequest): Promise<WorkerSlackReplyResponse> {
    const sessionId = resolveSlackSessionId(event);
    const saveResult = await this.history.saveMessage(event);

    this.logger.info("Captured Slack message", {
      sessionId,
      teamId: event.teamId,
      channelId: event.channelId,
      threadTs: event.threadTs,
      messageTs: event.messageTs,
      eventId: event.eventId,
      channelType: event.channelType,
      isMention: event.isMention,
      isThreadMessage: event.isThreadMessage,
      processingIntent: event.processingIntent,
      captureStatus: saveResult.status,
    });

    if (event.processingIntent === "capture") {
      return {
        status: "no_reply",
        reason: "capture_only",
      };
    }

    this.logger.info("Submitting Slack message to Think session", {
      sessionId,
      teamId: event.teamId,
      channelId: event.channelId,
      threadTs: event.threadTs,
      messageTs: event.messageTs,
      eventId: event.eventId,
      channelType: event.channelType,
    });

    const reply = await this.thinkSession.submitSlackMessage({
      sessionId,
      event,
    });

    if (!reply.text.trim()) {
      return {
        status: "no_reply",
        reason: "empty_agent_reply",
      };
    }

    return {
      status: "reply",
      text: reply.text,
      threadTs: event.threadTs ?? event.messageTs,
    };
  }
}
