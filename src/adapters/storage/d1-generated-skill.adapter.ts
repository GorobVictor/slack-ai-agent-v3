import type {
  GeneratedSkill,
  GeneratedSkillBody,
  GeneratedSkillCatalogStats,
  GeneratedSkillPort,
  SaveAutoApprovedSkillDecisionInput,
  SaveAutoApprovedSkillDecisionResult,
} from "../../ports/generated-skill.port.js";
import { normalizeGeneratedSkillBody } from "../../modules/agent/generated-skill-body.js";
import {
  GENERATED_SKILL_DEFAULT_DESCRIPTION_SUFFIX,
  GENERATED_SKILL_LEGACY_GOAL,
  renderGeneratedSkillBodyPrompt,
} from "../../prompts/generated-skills.prompts.js";

type GeneratedSkillRow = {
  id: string;
  name: string;
  description: string;
  body: string;
  body_json: string;
  allowed_tools: string | null;
  version: number;
  is_old: number;
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

  async saveAutoApprovedSkillDecision(
    input: SaveAutoApprovedSkillDecisionInput,
  ): Promise<SaveAutoApprovedSkillDecisionResult> {
    const current =
      input.action === "update"
        ? await this.findSkillByName(input.existingSkillName)
        : await this.findSkillByName(input.candidate.name);

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
    const version = current ? current.version + 1 : 1;

    if (current) {
      await this.db
        .prepare(
          `
            UPDATE generated_skills
            SET is_old = 1,
              updated_at = ?
            WHERE id = ?
          `,
        )
        .bind(now, current.id)
        .run();
    }

    await this.db
      .prepare(
        `
          INSERT INTO generated_skills (
            id,
            name,
            description,
            body,
            body_json,
            allowed_tools,
            version,
            is_old,
            disabled,
            confidence,
            auto_approval_reason,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        crypto.randomUUID(),
        input.candidate.name,
        input.candidate.description,
        renderedBody,
        JSON.stringify(normalizeGeneratedSkillBody(input.candidate.body)),
        input.candidate.allowedTools ?? null,
        version,
        0,
        0,
        input.candidate.confidence,
        input.candidate.autoApprovalReason,
        now,
        now,
      )
      .run();

    return {
      status: current ? "updated" : "inserted",
      skill: await this.loadEnabledSkill(input.candidate.name),
    };
  }

  async listEnabledSkills(): Promise<GeneratedSkill[]> {
    const result = await this.db
      .prepare(
        `
          SELECT id, name, description, body, body_json, allowed_tools, version,
            is_old, disabled,
            confidence, auto_approval_reason, created_at, updated_at
          FROM generated_skills
          WHERE disabled = 0
            AND is_old = 0
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
          SELECT id, name, description, body, body_json, allowed_tools, version,
            is_old, disabled,
            confidence, auto_approval_reason, created_at, updated_at
          FROM generated_skills
          WHERE name = ?
            AND disabled = 0
            AND is_old = 0
          ORDER BY version DESC
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
          SELECT id, name, description, body, body_json, allowed_tools, version,
            is_old, disabled,
            confidence, auto_approval_reason, created_at, updated_at
          FROM generated_skills
          WHERE name = ?
            AND is_old = 0
          ORDER BY version DESC
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
            AND is_old = 0
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
  input: SaveAutoApprovedSkillDecisionInput,
  renderedBody: string,
): boolean {
  return (
    existing.description === input.candidate.description &&
    existing.body === renderedBody &&
    existing.allowedTools === input.candidate.allowedTools
  );
}

function mapRow(row: GeneratedSkillRow): GeneratedSkill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    body: row.body,
    bodyJson: parseBodyJson(row.body_json),
    allowedTools: row.allowed_tools ?? undefined,
    version: row.version,
    isOld: Boolean(row.is_old),
    disabled: Boolean(row.disabled),
    confidence: row.confidence,
    autoApprovalReason: row.auto_approval_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseBodyJson(value: string): GeneratedSkillBody {
  try {
    return normalizeGeneratedSkillBody(JSON.parse(value) as GeneratedSkillBody);
  } catch {
    return {
      goal: GENERATED_SKILL_LEGACY_GOAL,
      triggers: [GENERATED_SKILL_DEFAULT_DESCRIPTION_SUFFIX],
      instructions: [value],
    };
  }
}
