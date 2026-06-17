import type { GeneratedSkill } from "../ports/generated-skill.port.js";
import type { SlackWorkerRequest } from "../modules/slack/slack.types.js";
import { GENERATED_SKILL_ALLOWED_TOOL } from "./generated-skills.prompts.js";
import { SKILL_REFLECTION_MAX_OUTPUT_TOKENS } from "../modules/agent/skill-reflection.use-case.js";

/**
 * Used by:
 * - src/modules/agent/skill-reflection.use-case.ts -> createModelSkillReflectionCandidateGenerator()
 * - src/modules/agent/skill-reflection.use-case.ts -> ReflectOnSlackConversationForSkillUseCase.execute()
 */
export const SKILL_REFLECTION_OUTPUT_NAME = "SkillReflectionDecision";

export const SKILL_REFLECTION_OUTPUT_DESCRIPTION =
  "A create, update, or skip decision for generated reusable skills.";

export function buildSkillReflectionSystemPrompt(): string {
  return [
    "You extract reusable procedural skills from Slack conversations.",
    "Create a skill only when the conversation reveals a durable workflow or response pattern that will improve future similar requests.",
    "Generated skills must be universal. Do not preserve Slack workspace, channel, thread, user, or message identifiers.",
    "Do not store secrets, credentials, private facts, personal preferences, or one-off conversation details.",
    "A skill must describe future agent behavior, not summarize what happened.",
    "Return action update when an existing skill covers the same workflow and the new candidate meaningfully improves it.",
    "For update, set candidate.name exactly to the existing skill name from the catalog.",
    "Return action create only when no existing skill covers the reusable workflow.",
    "Return action skip when an existing skill already covers the workflow without meaningful improvement.",
    "The skill name must be lowercase kebab-case, never snake_case or title case.",
    'The description must include the exact phrase "Use when" followed by a clear trigger.',
    "The candidate body must be typed: goal, triggers, instructions, optional safetyNotes, and optional toolUsage.",
    "Keep generated JSON compact. Do not add whitespace, markdown, or text after the JSON object.",
    "For create/update, use at most 3 triggers, 5 instructions, and 3 safety notes.",
    "Keep reason, goal, triggers, and instructions concise.",
    "If the pattern is weak, narrow, private, user-specific, or one-off, return action skip.",
    `You have to fit into ${SKILL_REFLECTION_MAX_OUTPUT_TOKENS} tokens.`,
    `Allowed tools for generated skills are limited to ${GENERATED_SKILL_ALLOWED_TOOL}.`,
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
    "For skip, return only a concise reason and confidence.",
    "Use action update only when improving an existing skill; set candidate.name exactly to that existing skill name.",
    "Use action create only for genuinely new reusable workflows.",
    'For create/update, write `name` in lowercase kebab-case and include "Use when" in `description`.',
    "For create/update, fill body.goal, body.triggers, body.instructions, optional body.safetyNotes, and optional body.toolUsage.",
    "For create/update, keep body.triggers to at most 3 items and body.instructions to at most 5 items.",
    "Keep body fields concise, universal, and written as instructions for future agent behavior.",
    "Return compact JSON only. Stop immediately after the closing JSON object.",
  ].join("\n");
}

export function buildExistingSkillsCatalogPrompt(skills: GeneratedSkill[]): string {
  if (skills.length === 0) {
    return "No current generated skills exist.";
  }

  return skills
    .map((skill) =>
      [
        `name: ${skill.name}`,
        `version: ${skill.version}`,
        `description: ${skill.description}`,
        `allowedTools: ${skill.allowedTools ?? "none"}`,
        `goal: ${skill.bodyJson.goal}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}
