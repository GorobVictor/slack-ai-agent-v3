export type GeneratedSkill = {
  id: string;
  name: string;
  description: string;
  body: string;
  allowedTools?: string;
  version: number;
  disabled: boolean;
  confidence: number;
  autoApprovalReason: string;
  createdAt: number;
  updatedAt: number;
};

export type UpsertAutoApprovedSkillInput = {
  name: string;
  description: string;
  body: string;
  allowedTools?: string;
  confidence: number;
  autoApprovalReason: string;
};

export type UpsertAutoApprovedSkillResult = {
  status: "inserted" | "updated" | "unchanged" | "skipped_disabled";
  skill: GeneratedSkill | null;
};

export type GeneratedSkillCatalogStats = {
  enabledCount: number;
  maxUpdatedAt: number;
};

export interface GeneratedSkillPort {
  upsertAutoApprovedSkill(
    input: UpsertAutoApprovedSkillInput,
  ): Promise<UpsertAutoApprovedSkillResult>;
  listEnabledSkills(): Promise<GeneratedSkill[]>;
  loadEnabledSkill(name: string): Promise<GeneratedSkill | null>;
  findSkillByName(name: string): Promise<GeneratedSkill | null>;
  getEnabledCatalogStats(): Promise<GeneratedSkillCatalogStats>;
}
