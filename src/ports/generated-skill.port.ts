export type GeneratedSkillBodyToolUsage = {
  tool: "getSlackHistoryContext";
  when: string;
};

export type GeneratedSkillBody = {
  goal: string;
  triggers: string[];
  instructions: string[];
  safetyNotes?: string[];
  toolUsage?: GeneratedSkillBodyToolUsage[];
};

export type GeneratedSkill = {
  id: string;
  name: string;
  description: string;
  body: string;
  bodyJson: GeneratedSkillBody;
  allowedTools?: string;
  version: number;
  isOld: boolean;
  disabled: boolean;
  confidence: number;
  autoApprovalReason: string;
  createdAt: number;
  updatedAt: number;
};

export type AutoApprovedGeneratedSkillCandidate = {
  name: string;
  description: string;
  body: GeneratedSkillBody;
  allowedTools?: string;
  confidence: number;
  autoApprovalReason: string;
};

export type SaveAutoApprovedSkillDecisionInput =
  | {
      action: "create";
      candidate: AutoApprovedGeneratedSkillCandidate;
    }
  | {
      action: "update";
      existingSkillName: string;
      candidate: AutoApprovedGeneratedSkillCandidate;
    };

export type SaveAutoApprovedSkillDecisionResult = {
  status: "inserted" | "updated" | "unchanged" | "skipped_disabled";
  skill: GeneratedSkill | null;
};

export type GeneratedSkillCatalogStats = {
  enabledCount: number;
  maxUpdatedAt: number;
};

export interface GeneratedSkillPort {
  saveAutoApprovedSkillDecision(
    input: SaveAutoApprovedSkillDecisionInput,
  ): Promise<SaveAutoApprovedSkillDecisionResult>;
  listEnabledSkills(): Promise<GeneratedSkill[]>;
  loadEnabledSkill(name: string): Promise<GeneratedSkill | null>;
  findSkillByName(name: string): Promise<GeneratedSkill | null>;
  getEnabledCatalogStats(): Promise<GeneratedSkillCatalogStats>;
}
