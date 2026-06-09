import { skills, type SkillSource } from "@cloudflare/think";

import { slackAgentSkillManifest } from "./agent.skills.manifest.js";

export const slackAgentSkillSource: SkillSource = skills.fromManifest(slackAgentSkillManifest);
