import type { SlackHistoryMessage } from "../ports/slack-message-history.port.js";

/**
 * Used by:
 * - src/modules/slack/slack-history-summary.use-case.ts -> BuildSlackHistoryContextUseCase.execute()
 * - src/modules/agent/agent.tools.ts -> getSlackHistoryContext tool result
 * - src/modules/agent/skill-reflection.use-case.ts -> skill reflection context
 */
export const EMPTY_SLACK_HISTORY_CONTEXT_PROMPT =
  "No Slack history was captured for the requested scope and time range.";

export function buildSlackHistoryContextPrompt(messages: SlackHistoryMessage[]): string {
  return messages
    .map((message) => {
      const thread = message.threadTs ? ` thread:${message.threadTs}` : "";
      return `[${message.messageTs}${thread}] <@${message.userId}>: ${message.text}`;
    })
    .join("\n");
}
