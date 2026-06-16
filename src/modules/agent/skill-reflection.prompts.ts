import type { SlackWorkerRequest } from "../slack/slack.types.js";

export function buildSkillReflectionSystemPrompt(): string {
  return [
    "You extract reusable procedural skills from Slack conversations.",
    "Create a skill only when the conversation reveals a durable workflow or response pattern that will improve future similar requests.",
    "Generated skills must be universal. Do not preserve Slack workspace, channel, thread, user, or message identifiers.",
    "Do not store secrets, credentials, private facts, personal preferences, or one-off conversation details.",
    "A skill must describe future agent behavior, not summarize what happened.",
    "The skill name must be lowercase kebab-case, never snake_case or title case.",
    'The description must include the exact phrase "Use when" followed by a clear trigger.',
    "If the pattern is weak, narrow, private, user-specific, or one-off, return shouldCreate false.",
    "Allowed tools for generated skills are limited to getSlackHistoryContext.",
  ].join("\n");
}

export function buildSkillReflectionPrompt(input: {
  event: SlackWorkerRequest;
  assistantReply: string;
  historyContext: string;
}): string {
  return [
    "Review this Slack conversation context and decide whether it contains a reusable procedural skill.",
    "",
    "Current user message:",
    input.event.text,
    "",
    "Assistant reply:",
    input.assistantReply,
    "",
    "Recent captured conversation context:",
    input.historyContext,
    "",
    "Return shouldCreate false unless there is a clear reusable pattern for future user requests.",
    'If creating a skill, write `name` in lowercase kebab-case and include "Use when" in `description`.',
    "If creating a skill, keep the body concise, universal, and written as instructions for future agent behavior.",
  ].join("\n");
}
