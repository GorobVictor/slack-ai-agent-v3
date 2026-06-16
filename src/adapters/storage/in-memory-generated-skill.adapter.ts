import type {
  GeneratedSkill,
  GeneratedSkillCatalogStats,
  GeneratedSkillPort,
  UpsertAutoApprovedSkillInput,
  UpsertAutoApprovedSkillResult,
} from "../../ports/generated-skill.port.js";

export class InMemoryGeneratedSkillAdapter implements GeneratedSkillPort {
  private readonly skills = new Map<string, GeneratedSkill>();

  constructor(initialSkills: GeneratedSkill[] = []) {
    for (const skill of initialSkills) {
      this.skills.set(skill.name, skill);
    }
  }

  async upsertAutoApprovedSkill(
    input: UpsertAutoApprovedSkillInput,
  ): Promise<UpsertAutoApprovedSkillResult> {
    const existing = this.skills.get(input.name) ?? null;

    if (existing?.disabled) {
      return {
        status: "skipped_disabled",
        skill: existing,
      };
    }

    if (existing && isUnchanged(existing, input)) {
      return {
        status: "unchanged",
        skill: existing,
      };
    }

    const now = Date.now();
    const skill: GeneratedSkill = {
      id: existing?.id ?? crypto.randomUUID(),
      name: input.name,
      description: input.description,
      body: input.body,
      allowedTools: input.allowedTools,
      version: existing ? existing.version + 1 : 1,
      disabled: false,
      confidence: input.confidence,
      autoApprovalReason: input.autoApprovalReason,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.skills.set(input.name, skill);

    return {
      status: existing ? "updated" : "inserted",
      skill,
    };
  }

  async listEnabledSkills(): Promise<GeneratedSkill[]> {
    return [...this.skills.values()]
      .filter((skill) => !skill.disabled)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async loadEnabledSkill(name: string): Promise<GeneratedSkill | null> {
    const skill = this.skills.get(name) ?? null;
    return skill && !skill.disabled ? skill : null;
  }

  async findSkillByName(name: string): Promise<GeneratedSkill | null> {
    return this.skills.get(name) ?? null;
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
  input: UpsertAutoApprovedSkillInput,
): boolean {
  return (
    existing.description === input.description &&
    existing.body === input.body &&
    existing.allowedTools === input.allowedTools
  );
}
