import type { SkillSource } from "@cloudflare/think";

import type { GeneratedSkill, GeneratedSkillPort } from "../../ports/generated-skill.port.js";

export const GENERATED_SKILL_SOURCE_ID = "slack-agent-generated-skills";

export function createGeneratedSkillSource(repository: GeneratedSkillPort): SkillSource {
  return {
    id: GENERATED_SKILL_SOURCE_ID,
    get fingerprint(): string {
      // The registry can use this to notice catalog changes between turns.
      return `generated-skills:${Date.now()}`;
    },
    async list() {
      const skills = await repository.listEnabledSkills();

      return skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        allowedTools: skill.allowedTools,
        sourceId: GENERATED_SKILL_SOURCE_ID,
        version: String(skill.version),
      }));
    },
    async load(name: string) {
      const skill = await repository.loadEnabledSkill(name);

      return skill ? mapSkillContent(skill) : null;
    },
    async refresh() {
      // D1 is the source of truth, so list/load read fresh rows directly.
    },
  };
}

function mapSkillContent(skill: GeneratedSkill) {
  return {
    name: skill.name,
    description: skill.description,
    body: skill.body,
    allowedTools: skill.allowedTools,
    sourceId: GENERATED_SKILL_SOURCE_ID,
    version: String(skill.version),
  };
}
