import type {
  SlackHistoryMessage,
  SlackMessageHistoryPort,
} from "../../ports/slack-message-history.port.js";
import {
  buildSlackHistoryContextPrompt,
  EMPTY_SLACK_HISTORY_CONTEXT_PROMPT,
} from "../../prompts/slack-history.prompts.js";
import type { SlackWorkerRequest } from "./slack.types.js";

export type SlackHistorySummaryScope = "thread" | "channel" | "channel_with_threads";

export type BuildSlackHistoryContextInput = {
  currentEvent: SlackWorkerRequest;
  scope: SlackHistorySummaryScope;
  days: number;
  threadTs?: string;
};

export class BuildSlackHistoryContextUseCase {
  constructor(private readonly history: SlackMessageHistoryPort) {}

  async execute(input: BuildSlackHistoryContextInput): Promise<string> {
    const range = buildSlackTimeRange(input.currentEvent.messageTs, input.days);
    const baseQuery = {
      teamId: input.currentEvent.teamId,
      channelId: input.currentEvent.channelId,
      sinceTs: range.sinceTs,
      untilTs: range.untilTs,
      limit: 500,
    };
    const messages =
      input.scope === "thread"
        ? await this.history.findMessagesByThreadAndTimeRange({
            ...baseQuery,
            threadTs: input.threadTs ?? input.currentEvent.threadTs ?? input.currentEvent.messageTs,
          })
        : input.scope === "channel_with_threads"
          ? await readChannelWithThreads(this.history, baseQuery)
          : await this.history.findMessagesByChannelAndTimeRange(baseQuery);

    if (messages.length === 0) {
      return EMPTY_SLACK_HISTORY_CONTEXT_PROMPT;
    }

    return buildSlackHistoryContextPrompt(messages);
  }
}

async function readChannelWithThreads(
  history: SlackMessageHistoryPort,
  baseQuery: {
    teamId: string;
    channelId: string;
    sinceTs: string;
    untilTs: string;
    limit: number;
  },
): Promise<SlackHistoryMessage[]> {
  const [channelMessages, threadMessages] = await Promise.all([
    history.findMessagesByChannelAndTimeRange(baseQuery),
    history.findThreadMessagesByChannelAndTimeRange(baseQuery),
  ]);

  return [...channelMessages, ...threadMessages].sort((left, right) =>
    left.messageTs.localeCompare(right.messageTs),
  );
}

function buildSlackTimeRange(messageTs: string, days: number): { sinceTs: string; untilTs: string } {
  const until = Number(messageTs);
  const safeUntil = Number.isFinite(until) ? until : Date.now() / 1_000;
  const safeDays = Math.max(1, Math.min(Math.floor(days), 30));

  return {
    sinceTs: (safeUntil - safeDays * 86_400).toFixed(6),
    untilTs: safeUntil.toFixed(6),
  };
}
