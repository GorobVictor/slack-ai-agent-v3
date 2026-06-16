import type { SkillSource } from "@cloudflare/think";

import type { GeneratedSkillPort } from "../../ports/generated-skill.port.js";
import { createGeneratedSkillSource } from "./generated-skill-source.js";

export function createSlackAgentSkillSources(repository: GeneratedSkillPort): SkillSource[] {
  return [createGeneratedSkillSource(repository)];
}
