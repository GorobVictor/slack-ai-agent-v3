import type { GeneratedSkillBody } from "../ports/generated-skill.port.js";

/**
 * Used by:
 * - src/modules/agent/generated-skill-policy.ts -> generated skill validation defaults
 * - src/adapters/storage/d1-generated-skill.adapter.ts -> stored runtime skill body
 * - src/adapters/storage/in-memory-generated-skill.adapter.ts -> stored runtime skill body
 */
export const GENERATED_SKILL_ALLOWED_TOOL = "getSlackHistoryContext" as const;

export const GENERATED_SKILL_DEFAULT_DESCRIPTION_SUFFIX =
  "Use when a future user request clearly matches this reusable workflow.";

export const GENERATED_SKILL_LEGACY_GOAL = "Legacy generated skill";

export function renderGeneratedSkillBodyPrompt(body: GeneratedSkillBody): string {
  const sections = [
    renderParagraph("Goal", body.goal),
    renderList("Triggers", body.triggers),
    renderList("Instructions", body.instructions),
    renderList("Safety Notes", body.safetyNotes),
    renderToolUsage(body.toolUsage),
  ].filter((section) => section.length > 0);

  return sections.join("\n\n");
}

function renderParagraph(title: string, value: string): string {
  const text = value.trim();

  return text ? `## ${title}\n\n${text}` : "";
}

function renderList(title: string, values: string[] | undefined): string {
  const normalized = normalizePromptList(values);

  if (normalized.length === 0) {
    return "";
  }

  return [`## ${title}`, "", ...normalized.map((value) => `- ${value}`)].join("\n");
}

function renderToolUsage(toolUsage: GeneratedSkillBody["toolUsage"]): string {
  if (!toolUsage || toolUsage.length === 0) {
    return "";
  }

  return [
    "## Tool Usage",
    "",
    ...toolUsage.map((usage) => `- Call \`${usage.tool}\` when ${usage.when}`),
  ].join("\n");
}

function normalizePromptList(values: string[] | undefined): string[] {
  return [...new Set(values?.map((value) => value.trim()).filter(Boolean) ?? [])];
}
