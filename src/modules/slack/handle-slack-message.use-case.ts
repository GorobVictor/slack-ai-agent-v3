import type { LoggerPort } from "../../ports/logger.port.js";
import type { ThinkSessionPort } from "../../ports/think-session.port.js";
import { resolveSlackSessionId } from "./slack-session-resolver.js";
import type {
  NormalizedSlackMessageEvent,
  WorkerSlackReplyResponse,
} from "./slack.types.js";

export class HandleSlackMessageUseCase {
  constructor(
    private readonly thinkSession: ThinkSessionPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(event: NormalizedSlackMessageEvent): Promise<WorkerSlackReplyResponse> {
    const sessionId = resolveSlackSessionId(event);

    this.logger.info("Submitting Slack message to Think session", {
      sessionId,
      teamId: event.teamId,
      channelId: event.channelId,
      threadTs: event.threadTs,
      messageTs: event.messageTs,
      eventId: event.eventId,
      channelType: event.channelType,
      isMention: event.isMention,
      isThreadMessage: event.isThreadMessage,
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
