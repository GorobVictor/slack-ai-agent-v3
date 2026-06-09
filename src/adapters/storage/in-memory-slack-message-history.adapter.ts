import type {
  SaveSlackMessageResult,
  SlackHistoryMessage,
  SlackHistoryTimeRange,
  SlackMessageHistoryPort,
  SlackThreadHistoryTimeRange,
} from "../../ports/slack-message-history.port.js";
import type { SlackWorkerRequest } from "../../modules/slack/slack.types.js";

export class InMemorySlackMessageHistoryAdapter implements SlackMessageHistoryPort {
  private readonly messages = new Map<string, SlackHistoryMessage>();

  async saveMessage(event: SlackWorkerRequest): Promise<SaveSlackMessageResult> {
    if (this.messages.has(event.idempotencyKey)) {
      return { status: "duplicate" };
    }

    this.messages.set(event.idempotencyKey, {
      teamId: event.teamId,
      channelId: event.channelId,
      userId: event.userId,
      messageTs: event.messageTs,
      threadTs: event.threadTs,
      text: event.text,
      channelType: event.channelType,
      isMention: event.isMention,
      isThreadMessage: event.isThreadMessage,
      processingIntent: event.processingIntent,
    });

    return { status: "inserted" };
  }

  async findMessagesByChannelAndTimeRange(
    input: SlackHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]> {
    return this.filterByRange(input, (message) => !message.threadTs);
  }

  async findMessagesByThreadAndTimeRange(
    input: SlackThreadHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]> {
    return this.filterByRange(
      input,
      (message) => (message.threadTs ?? message.messageTs) === input.threadTs,
    );
  }

  async findThreadMessagesByChannelAndTimeRange(
    input: SlackHistoryTimeRange,
  ): Promise<SlackHistoryMessage[]> {
    return this.filterByRange(input, (message) => Boolean(message.threadTs));
  }

  private filterByRange(
    input: SlackHistoryTimeRange,
    predicate: (message: SlackHistoryMessage) => boolean,
  ): SlackHistoryMessage[] {
    return [...this.messages.values()]
      .filter(
        (message) =>
          message.teamId === input.teamId &&
          message.channelId === input.channelId &&
          message.messageTs >= input.sinceTs &&
          message.messageTs <= input.untilTs &&
          predicate(message),
      )
      .sort((left, right) => left.messageTs.localeCompare(right.messageTs))
      .slice(0, input.limit ?? 500);
  }
}
