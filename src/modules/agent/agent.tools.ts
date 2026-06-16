import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import {
  BuildSlackHistoryContextUseCase,
  type SlackHistorySummaryScope,
} from "../slack/slack-history-summary.use-case.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";

const slackHistoryContextInputSchema = z.object({
  scope: z
    .enum(["thread", "channel", "channel_with_threads"])
    .describe("The Slack history scope to read."),
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .describe("How many days of recent captured history to include."),
  threadTs: z
    .string()
    .min(1)
    .optional()
    .describe("Thread timestamp for thread summaries. Defaults to the current thread."),
});

export type SlackHistoryContextToolInput = {
  scope: SlackHistorySummaryScope;
  days: number;
  threadTs?: string;
};

export type SlackAgentToolsOptions = {
  history: SlackMessageHistoryPort;
  getActiveSlackEvent: () => SlackWorkerRequest | null;
};

export function createSlackAgentTools(options: SlackAgentToolsOptions): ToolSet {
  return {
    getSlackHistoryContext: tool({
      description:
        "Read captured Slack history for summarization. Use this before summarizing a thread, channel, or channel with threads.",
      inputSchema: slackHistoryContextInputSchema,
      execute: (input) => readSlackHistoryContextForTool(input, options),
    }),
  };
}

export async function readSlackHistoryContextForTool(
  input: SlackHistoryContextToolInput,
  options: SlackAgentToolsOptions,
): Promise<string> {
  const currentEvent = options.getActiveSlackEvent();

  if (!currentEvent) {
    return "Slack history context is only available while processing a Slack message.";
  }

  return new BuildSlackHistoryContextUseCase(options.history).execute({
    currentEvent,
    scope: input.scope,
    days: input.days,
    threadTs: input.threadTs,
  });
}
