import { describe, expect, it } from "vitest";

import { D1GeneratedSkillAdapter } from "./d1-generated-skill.adapter.js";

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

describe("D1GeneratedSkillAdapter", () => {
  it("inserts, skips unchanged updates, and updates changed enabled skills", async () => {
    const adapter = new D1GeneratedSkillAdapter(fakeD1());
    const input = skillInput();

    await expect(adapter.upsertAutoApprovedSkill(input)).resolves.toMatchObject({
      status: "inserted",
      skill: {
        name: input.name,
        version: 1,
      },
    });

    await expect(adapter.upsertAutoApprovedSkill(input)).resolves.toMatchObject({
      status: "unchanged",
      skill: {
        name: input.name,
        version: 1,
      },
    });

    await expect(
      adapter.upsertAutoApprovedSkill({
        ...input,
        body: "Updated reusable workflow instructions.",
      }),
    ).resolves.toMatchObject({
      status: "updated",
      skill: {
        name: input.name,
        version: 2,
      },
    });
  });

  it("does not load disabled skills and does not re-enable them during upsert", async () => {
    const db = fakeD1([
      row({
        name: "disabled-skill",
        disabled: 1,
      }),
      row({
        name: "enabled-skill",
        disabled: 0,
      }),
    ]);
    const adapter = new D1GeneratedSkillAdapter(db);

    await expect(adapter.listEnabledSkills()).resolves.toEqual([
      expect.objectContaining({ name: "enabled-skill" }),
    ]);
    await expect(adapter.loadEnabledSkill("disabled-skill")).resolves.toBeNull();
    await expect(
      adapter.upsertAutoApprovedSkill(skillInput({ name: "disabled-skill" })),
    ).resolves.toMatchObject({
      status: "skipped_disabled",
      skill: {
        name: "disabled-skill",
        disabled: true,
      },
    });
  });
});

function skillInput(overrides: Partial<Parameters<D1GeneratedSkillAdapter["upsertAutoApprovedSkill"]>[0]> = {}) {
  return {
    name: "summarize-recurring-blockers",
    description:
      "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers.",
    body: "Group repeated blockers, identify explicit owners, and avoid inventing missing details.",
    allowedTools: "getSlackHistoryContext",
    confidence: 0.95,
    autoApprovalReason: "Reusable workflow for blocker summaries.",
    ...overrides,
  };
}

function fakeD1(initialRows: GeneratedSkillRow[] = []): D1Database {
  const rows = [...initialRows];

  return {
    prepare(query: string) {
      return statement(query, rows);
    },
  } as unknown as D1Database;
}

function statement(query: string, rows: GeneratedSkillRow[]) {
  return {
    bind(...values: unknown[]) {
      return executable(query, rows, values);
    },
    async all() {
      return executable(query, rows, []).all();
    },
    async first() {
      return executable(query, rows, []).first();
    },
  };
}

function executable(query: string, rows: GeneratedSkillRow[], values: unknown[]) {
  return {
    async run() {
      if (query.includes("INSERT INTO generated_skills")) {
        rows.push({
          id: String(values[0]),
          name: String(values[1]),
          description: String(values[2]),
          body: String(values[3]),
          allowed_tools: values[4] === null ? null : String(values[4]),
          version: Number(values[5]),
          disabled: Number(values[6]),
          confidence: Number(values[7]),
          auto_approval_reason: String(values[8]),
          created_at: Number(values[9]),
          updated_at: Number(values[10]),
        });

        return { meta: { changes: 1 } };
      }

      if (query.includes("UPDATE generated_skills")) {
        const name = String(values[6]);
        const target = rows.find((candidate) => candidate.name === name && candidate.disabled === 0);

        if (!target) {
          return { meta: { changes: 0 } };
        }

        target.description = String(values[0]);
        target.body = String(values[1]);
        target.allowed_tools = values[2] === null ? null : String(values[2]);
        target.version += 1;
        target.confidence = Number(values[3]);
        target.auto_approval_reason = String(values[4]);
        target.updated_at = Number(values[5]);

        return { meta: { changes: 1 } };
      }

      return { meta: { changes: 0 } };
    },
    async all() {
      return {
        results: rows.filter((candidate) => candidate.disabled === 0).sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      };
    },
    async first() {
      if (query.includes("COUNT(*)")) {
        const enabledRows = rows.filter((candidate) => candidate.disabled === 0);

        return {
          enabled_count: enabledRows.length,
          max_updated_at: Math.max(0, ...enabledRows.map((candidate) => candidate.updated_at)),
        };
      }

      const name = String(values[0]);
      const row = rows.find((candidate) => candidate.name === name) ?? null;

      if (query.includes("AND disabled = 0") && row?.disabled) {
        return null;
      }

      return row;
    },
  };
}

function row(overrides: Partial<GeneratedSkillRow> = {}): GeneratedSkillRow {
  return {
    id: crypto.randomUUID(),
    name: "summarize-recurring-blockers",
    description:
      "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers.",
    body: "Group repeated blockers, identify explicit owners, and avoid inventing missing details.",
    allowed_tools: "getSlackHistoryContext",
    version: 1,
    disabled: 0,
    confidence: 0.95,
    auto_approval_reason: "Reusable workflow for blocker summaries.",
    created_at: 1710000000000,
    updated_at: 1710000000000,
    ...overrides,
  };
}
