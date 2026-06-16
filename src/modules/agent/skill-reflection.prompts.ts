import type { SlackWorkerRequest } from "../slack/slack.types.js";

export function buildSkillReflectionSystemPrompt(): string {
  return [
    "You extract reusable procedural skills from Slack conversations.",
    "Create a skill only when the conversation reveals a durable workflow or response pattern that will improve future similar requests.",
    "Generated skills must be universal. Do not preserve Slack workspace, channel, thread, user, or message identifiers.",
    "Do not store secrets, credentials, private facts, personal preferences, or one-off conversation details.",
    "A skill must describe future agent behavior, not summarize what happened.",
    "Return action update when an existing skill covers the same workflow and the new candidate meaningfully improves it.",
    "Return action create only when no existing skill covers the reusable workflow.",
    "Return action skip when an existing skill already covers the workflow without meaningful improvement.",
    "The skill name must be lowercase kebab-case, never snake_case or title case.",
    'The description must include the exact phrase "Use when" followed by a clear trigger.',
    "The candidate body must be typed: goal, triggers, instructions, optional safetyNotes, and optional toolUsage.",
    "If the pattern is weak, narrow, private, user-specific, or one-off, return action skip.",
    "Allowed tools for generated skills are limited to getSlackHistoryContext.",
  ].join("\n");
}

export function buildSkillReflectionPrompt(input: {
  event: SlackWorkerRequest;
  assistantReply: string;
  historyContext: string;
  existingSkillsCatalog: string;
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
    "Current generated skills catalog:",
    input.existingSkillsCatalog,
    "",
    "Return action skip unless there is a clear reusable pattern for future user requests.",
    "Use action update with existingSkillName if an existing skill should be improved.",
    "Use action create only for genuinely new reusable workflows.",
    'For create/update, write `name` in lowercase kebab-case and include "Use when" in `description`.',
    "For create/update, fill body.goal, body.triggers, body.instructions, optional body.safetyNotes, and optional body.toolUsage.",
    "Keep body fields concise, universal, and written as instructions for future agent behavior.",
  ].join("\n");
}
