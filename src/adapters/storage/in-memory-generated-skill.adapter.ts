import type {
  GeneratedSkill,
  GeneratedSkillCatalogStats,
  GeneratedSkillPort,
  SaveAutoApprovedSkillDecisionInput,
  SaveAutoApprovedSkillDecisionResult,
} from "../../ports/generated-skill.port.js";
import { normalizeGeneratedSkillBody } from "../../modules/agent/generated-skill-body.js";
import { renderGeneratedSkillBodyPrompt } from "../../prompts/generated-skills.prompts.js";

export class InMemoryGeneratedSkillAdapter implements GeneratedSkillPort {
  private readonly skills: GeneratedSkill[] = [];

  constructor(initialSkills: GeneratedSkill[] = []) {
    this.skills.push(...initialSkills);
  }

  async saveAutoApprovedSkillDecision(
    input: SaveAutoApprovedSkillDecisionInput,
  ): Promise<SaveAutoApprovedSkillDecisionResult> {
    const current = await this.findSkillByName(input.candidate.name);

    if (current?.disabled) {
      return {
        status: "skipped_disabled",
        skill: current,
      };
    }

    const renderedBody = renderGeneratedSkillBodyPrompt(input.candidate.body);

    if (current && isUnchanged(current, input, renderedBody)) {
      return {
        status: "unchanged",
        skill: current,
      };
    }

    const now = Date.now();

    if (current) {
      current.isOld = true;
      current.updatedAt = now;
    }

    const skill: GeneratedSkill = {
      id: crypto.randomUUID(),
      name: input.candidate.name,
      description: input.candidate.description,
      body: renderedBody,
      bodyJson: normalizeGeneratedSkillBody(input.candidate.body),
      allowedTools: input.candidate.allowedTools,
      version: current ? current.version + 1 : 1,
      isOld: false,
      disabled: false,
      confidence: input.candidate.confidence,
      autoApprovalReason: input.candidate.autoApprovalReason,
      createdAt: now,
      updatedAt: now,
    };

    this.skills.push(skill);

    return {
      status: current ? "updated" : "inserted",
      skill,
    };
  }

  async listEnabledSkills(): Promise<GeneratedSkill[]> {
    return this.skills
      .filter((skill) => !skill.disabled && !skill.isOld)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async loadEnabledSkill(name: string): Promise<GeneratedSkill | null> {
    const skill = await this.findSkillByName(name);
    return skill && !skill.disabled && !skill.isOld ? skill : null;
  }

  async findSkillByName(name: string): Promise<GeneratedSkill | null> {
    return (
      this.skills
        .filter((skill) => skill.name === name && !skill.isOld)
        .sort((left, right) => right.version - left.version)[0] ?? null
    );
  }

  async getEnabledCatalogStats(): Promise<GeneratedSkillCatalogStats> {
    const enabledSkills = await this.listEnabledSkills();

    return {
      enabledCount: enabledSkills.length,
      maxUpdatedAt: enabledSkills.reduce(
        (maxUpdatedAt, skill) => Math.max(maxUpdatedAt, skill.updatedAt),
        0,
      ),
    };
  }
}

function isUnchanged(
  existing: GeneratedSkill,
  input: SaveAutoApprovedSkillDecisionInput,
  renderedBody: string,
): boolean {
  return (
    existing.description === input.candidate.description &&
    existing.body === renderedBody &&
    existing.allowedTools === input.candidate.allowedTools
  );
}
