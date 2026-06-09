import type { NormalizedSlackMessageEvent } from "../slack/slack.types.js";

export type SlackThinkAgentEnv = {
  AI: Ai;
  AI_MODEL?: string;
};

export type RunSlackTurnInput = {
  event: NormalizedSlackMessageEvent;
};

export type RunSlackTurnResult = {
  text: string;
};
