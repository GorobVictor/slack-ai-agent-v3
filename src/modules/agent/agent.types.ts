import type { SlackWorkerRequest } from "../slack/slack.types.js";

export type SlackThinkAgentEnv = {
  AI: Ai;
  AI_GATEWAY_ID?: string;
  AI_MODEL?: string;
  SLACK_HISTORY_DB: D1Database;
};

export type RunSlackTurnInput = {
  event: SlackWorkerRequest;
};

export type RunSlackTurnResult = {
  text: string;
};
