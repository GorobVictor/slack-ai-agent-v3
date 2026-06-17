/**
 * Used by:
 * - src/modules/agent/agent.tools.ts -> getSlackHistoryContext tool definition
 * - src/modules/agent/agent.tools.ts -> readSlackHistoryContextForTool()
 */
export const GET_SLACK_HISTORY_CONTEXT_TOOL_DESCRIPTION =
  "Read captured Slack history for summarization. Use this before summarizing a thread, channel, or channel with threads.";

export const SLACK_HISTORY_SCOPE_DESCRIPTION = "The Slack history scope to read.";

export const SLACK_HISTORY_DAYS_DESCRIPTION =
  "How many days of recent captured history to include.";

export const SLACK_HISTORY_THREAD_TS_DESCRIPTION =
  "Thread timestamp for thread summaries. Defaults to the current thread.";

export const SLACK_HISTORY_CONTEXT_UNAVAILABLE_PROMPT =
  "Slack history context is only available while processing a Slack message.";
