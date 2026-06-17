import type { GeneratedSkillBody } from "../../ports/generated-skill.port.js";

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

function normalizeList(values: string[] | undefined): string[] {
  return [...new Set(values?.map((value) => value.trim()).filter(Boolean) ?? [])];
}
