import type { GeneratedSkillBody } from "../../ports/generated-skill.port.js";

export function renderGeneratedSkillBody(body: GeneratedSkillBody): string {
  const sections = [
    renderParagraph("Goal", body.goal),
    renderList("Triggers", body.triggers),
    renderList("Instructions", body.instructions),
    renderList("Safety Notes", body.safetyNotes),
    renderToolUsage(body.toolUsage),
  ].filter((section) => section.length > 0);

  return sections.join("\n\n");
}

export function normalizeGeneratedSkillBody(body: GeneratedSkillBody): GeneratedSkillBody {
  return {
    goal: body.goal.trim(),
    triggers: normalizeList(body.triggers),
    instructions: normalizeList(body.instructions),
    safetyNotes: normalizeList(body.safetyNotes),
    toolUsage: body.toolUsage
      ?.map((usage) => ({
        tool: usage.tool,
        when: usage.when.trim(),
      }))
      .filter((usage) => usage.when.length > 0),
  };
}

function renderParagraph(title: string, value: string): string {
  const text = value.trim();

  return text ? `## ${title}\n\n${text}` : "";
}

function renderList(title: string, values: string[] | undefined): string {
  const normalized = normalizeList(values);

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

function normalizeList(values: string[] | undefined): string[] {
  return [...new Set(values?.map((value) => value.trim()).filter(Boolean) ?? [])];
}
