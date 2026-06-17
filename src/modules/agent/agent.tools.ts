import { tool, type ToolSet } from "ai";
import { z } from "zod";

import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import {
  GET_SLACK_HISTORY_CONTEXT_TOOL_DESCRIPTION,
  SLACK_HISTORY_CONTEXT_UNAVAILABLE_PROMPT,
  SLACK_HISTORY_DAYS_DESCRIPTION,
  SLACK_HISTORY_SCOPE_DESCRIPTION,
  SLACK_HISTORY_THREAD_TS_DESCRIPTION,
} from "../../prompts/agent-tools.prompts.js";
import {
  BuildSlackHistoryContextUseCase,
  type SlackHistorySummaryScope,
} from "../slack/slack-history-summary.use-case.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";

const slackHistoryContextInputSchema = z.object({
  scope: z
    .enum(["thread", "channel", "channel_with_threads"])
    .describe(SLACK_HISTORY_SCOPE_DESCRIPTION),
  days: z
    .number()
    .int()
    .min(1)
    .max(30)
    .describe(SLACK_HISTORY_DAYS_DESCRIPTION),
  threadTs: z
    .string()
    .min(1)
    .optional()
    .describe(SLACK_HISTORY_THREAD_TS_DESCRIPTION),
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
      description: GET_SLACK_HISTORY_CONTEXT_TOOL_DESCRIPTION,
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
    return SLACK_HISTORY_CONTEXT_UNAVAILABLE_PROMPT;
  }

  return new BuildSlackHistoryContextUseCase(options.history).execute({
    currentEvent,
    scope: input.scope,
    days: input.days,
    threadTs: input.threadTs,
  });
}
