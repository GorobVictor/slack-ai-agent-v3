import type {
  GeneratedSkill,
  GeneratedSkillCatalogStats,
  GeneratedSkillPort,
  UpsertAutoApprovedSkillInput,
  UpsertAutoApprovedSkillResult,
} from "../../ports/generated-skill.port.js";

type GeneratedSkillRow = {
  id: string;
  name: string;
  description: string;
  body: string;
  allowed_tools: string | null;
  version: number;
  disabled: number;
  confidence: number;
  auto_approval_reason: string;
  created_at: number;
  updated_at: number;
};

type CatalogStatsRow = {
  enabled_count: number;
  max_updated_at: number | null;
};

export class D1GeneratedSkillAdapter implements GeneratedSkillPort {
  constructor(private readonly db: D1Database) {}

  async upsertAutoApprovedSkill(
    input: UpsertAutoApprovedSkillInput,
  ): Promise<UpsertAutoApprovedSkillResult> {
    const existing = await this.findSkillByName(input.name);

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

    if (!existing) {
      await this.db
        .prepare(
          `
            INSERT INTO generated_skills (
              id,
              name,
              description,
              body,
              allowed_tools,
              version,
              disabled,
              confidence,
              auto_approval_reason,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .bind(
          crypto.randomUUID(),
          input.name,
          input.description,
          input.body,
          input.allowedTools ?? null,
          1,
          0,
          input.confidence,
          input.autoApprovalReason,
          now,
          now,
        )
        .run();

      return {
        status: "inserted",
        skill: await this.loadEnabledSkill(input.name),
      };
    }

    await this.db
      .prepare(
        `
          UPDATE generated_skills
          SET description = ?,
            body = ?,
            allowed_tools = ?,
            version = version + 1,
            confidence = ?,
            auto_approval_reason = ?,
            updated_at = ?
          WHERE name = ?
            AND disabled = 0
        `,
      )
      .bind(
        input.description,
        input.body,
        input.allowedTools ?? null,
        input.confidence,
        input.autoApprovalReason,
        now,
        input.name,
      )
      .run();

    return {
      status: "updated",
      skill: await this.loadEnabledSkill(input.name),
    };
  }

  async listEnabledSkills(): Promise<GeneratedSkill[]> {
    const result = await this.db
      .prepare(
        `
          SELECT id, name, description, body, allowed_tools, version, disabled,
            confidence, auto_approval_reason, created_at, updated_at
          FROM generated_skills
          WHERE disabled = 0
          ORDER BY name ASC
        `,
      )
      .all<GeneratedSkillRow>();

    return result.results.map(mapRow);
  }

  async loadEnabledSkill(name: string): Promise<GeneratedSkill | null> {
    const row = await this.db
      .prepare(
        `
          SELECT id, name, description, body, allowed_tools, version, disabled,
            confidence, auto_approval_reason, created_at, updated_at
          FROM generated_skills
          WHERE name = ?
            AND disabled = 0
          LIMIT 1
        `,
      )
      .bind(name)
      .first<GeneratedSkillRow>();

    return row ? mapRow(row) : null;
  }

  async findSkillByName(name: string): Promise<GeneratedSkill | null> {
    const row = await this.db
      .prepare(
        `
          SELECT id, name, description, body, allowed_tools, version, disabled,
            confidence, auto_approval_reason, created_at, updated_at
          FROM generated_skills
          WHERE name = ?
          LIMIT 1
        `,
      )
      .bind(name)
      .first<GeneratedSkillRow>();

    return row ? mapRow(row) : null;
  }

  async getEnabledCatalogStats(): Promise<GeneratedSkillCatalogStats> {
    const row = await this.db
      .prepare(
        `
          SELECT COUNT(*) AS enabled_count, MAX(updated_at) AS max_updated_at
          FROM generated_skills
          WHERE disabled = 0
        `,
      )
      .first<CatalogStatsRow>();

    return {
      enabledCount: row?.enabled_count ?? 0,
      maxUpdatedAt: row?.max_updated_at ?? 0,
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

function mapRow(row: GeneratedSkillRow): GeneratedSkill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    allowedTools: row.allowed_tools ?? undefined,
    version: row.version,
    disabled: Boolean(row.disabled),
    confidence: row.confidence,
    autoApprovalReason: row.auto_approval_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
