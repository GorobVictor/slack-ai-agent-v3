import { describe, expect, it } from "vitest";

import { D1GeneratedSkillAdapter } from "./d1-generated-skill.adapter.js";
import type { SaveAutoApprovedSkillDecisionInput } from "../../ports/generated-skill.port.js";

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

describe("D1GeneratedSkillAdapter", () => {
  it("inserts version 1, skips unchanged saves, and creates a new version on update", async () => {
    const rows: GeneratedSkillRow[] = [];
    const adapter = new D1GeneratedSkillAdapter(fakeD1(rows));
    const decision = createDecision();

    await expect(adapter.saveAutoApprovedSkillDecision(decision)).resolves.toMatchObject({
      status: "inserted",
      skill: {
        name: "summarize-recurring-blockers",
        version: 1,
        isOld: false,
      },
    });

    await expect(adapter.saveAutoApprovedSkillDecision(decision)).resolves.toMatchObject({
      status: "unchanged",
      skill: {
        name: "summarize-recurring-blockers",
        version: 1,
      },
    });

    await expect(
      adapter.saveAutoApprovedSkillDecision({
        action: "update",
        candidate: {
          ...decision.candidate,
          body: {
            ...decision.candidate.body,
            instructions: ["Group repeated blockers by topic.", "Include explicit owners only."],
          },
        },
      }),
    ).resolves.toMatchObject({
      status: "updated",
      skill: {
        name: "summarize-recurring-blockers",
        version: 2,
        isOld: false,
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ version: 1, is_old: 1 });
    expect(rows[1]).toMatchObject({ version: 2, is_old: 0 });
  });

  it("lists and loads only current enabled skills", async () => {
    const adapter = new D1GeneratedSkillAdapter(
      fakeD1([
        row({ name: "old-skill", version: 1, is_old: 1 }),
        row({ name: "disabled-skill", disabled: 1 }),
        row({ name: "enabled-skill", disabled: 0, is_old: 0 }),
      ]),
    );

    await expect(adapter.listEnabledSkills()).resolves.toEqual([
      expect.objectContaining({ name: "enabled-skill" }),
    ]);
    await expect(adapter.loadEnabledSkill("old-skill")).resolves.toBeNull();
    await expect(adapter.loadEnabledSkill("disabled-skill")).resolves.toBeNull();
  });

  it("does not update disabled current skills", async () => {
    const adapter = new D1GeneratedSkillAdapter(
      fakeD1([
        row({
          name: "disabled-skill",
          disabled: 1,
        }),
      ]),
    );

    await expect(
      adapter.saveAutoApprovedSkillDecision(
        createDecision({
          name: "disabled-skill",
        }),
      ),
    ).resolves.toMatchObject({
      status: "skipped_disabled",
      skill: {
        name: "disabled-skill",
        disabled: true,
      },
    });
  });
});

function createDecision(
  overrides: Partial<SaveAutoApprovedSkillDecisionInput["candidate"]> = {},
): SaveAutoApprovedSkillDecisionInput {
  return {
    action: "create",
    candidate: {
      name: "summarize-recurring-blockers",
      description:
        "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers.",
      body: {
        goal: "Summarize recurring blockers from recent discussion.",
        triggers: ["Use when users ask about repeated blockers."],
        instructions: ["Group repeated blockers by topic.", "Avoid inventing missing details."],
      },
      allowedTools: "getSlackHistoryContext",
      confidence: 0.95,
      autoApprovalReason: "Reusable workflow for blocker summaries.",
      ...overrides,
    },
  };
}

function fakeD1(rows: GeneratedSkillRow[]): D1Database {
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
      if (query.includes("SET is_old = 1")) {
        const id = String(values[1]);
        const target = rows.find((candidate) => candidate.id === id);

        if (target) {
          target.is_old = 1;
          target.updated_at = Number(values[0]);
        }

        return { meta: { changes: target ? 1 : 0 } };
      }

      if (query.includes("INSERT INTO generated_skills")) {
        rows.push({
          id: String(values[0]),
          name: String(values[1]),
          description: String(values[2]),
          body: String(values[3]),
          body_json: String(values[4]),
          allowed_tools: values[5] === null ? null : String(values[5]),
          version: Number(values[6]),
          is_old: Number(values[7]),
          disabled: Number(values[8]),
          confidence: Number(values[9]),
          auto_approval_reason: String(values[10]),
          created_at: Number(values[11]),
          updated_at: Number(values[12]),
        });

        return { meta: { changes: 1 } };
      }

      return { meta: { changes: 0 } };
    },
    async all() {
      return {
        results: rows
          .filter((candidate) => candidate.disabled === 0 && candidate.is_old === 0)
          .sort((left, right) => left.name.localeCompare(right.name)),
      };
    },
    async first() {
      if (query.includes("COUNT(*)")) {
        const enabledRows = rows.filter(
          (candidate) => candidate.disabled === 0 && candidate.is_old === 0,
        );

        return {
          enabled_count: enabledRows.length,
          max_updated_at: Math.max(0, ...enabledRows.map((candidate) => candidate.updated_at)),
        };
      }

      const name = String(values[0]);
      const row =
        rows
          .filter((candidate) => candidate.name === name)
          .filter((candidate) => !query.includes("AND disabled = 0") || candidate.disabled === 0)
          .filter((candidate) => !query.includes("AND is_old = 0") || candidate.is_old === 0)
          .sort((left, right) => right.version - left.version)[0] ?? null;

      return row;
    },
  };
}

function row(overrides: Partial<GeneratedSkillRow> = {}): GeneratedSkillRow {
  const bodyJson = {
    goal: "Summarize recurring blockers from recent discussion.",
    triggers: ["Use when users ask about repeated blockers."],
    instructions: ["Group repeated blockers by topic.", "Avoid inventing missing details."],
  };

  return {
    id: crypto.randomUUID(),
    name: "summarize-recurring-blockers",
    description:
      "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers.",
    body: "## Goal\n\nSummarize recurring blockers from recent discussion.",
    body_json: JSON.stringify(bodyJson),
    allowed_tools: "getSlackHistoryContext",
    version: 1,
    is_old: 0,
    disabled: 0,
    confidence: 0.95,
    auto_approval_reason: "Reusable workflow for blocker summaries.",
    created_at: 1710000000000,
    updated_at: 1710000000000,
    ...overrides,
  };
}
