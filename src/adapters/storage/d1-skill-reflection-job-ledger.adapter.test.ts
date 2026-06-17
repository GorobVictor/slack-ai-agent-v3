import { describe, expect, it } from "vitest";

import { D1SkillReflectionJobLedgerAdapter } from "./d1-skill-reflection-job-ledger.adapter.js";

type SkillReflectionJobRow = {
  idempotency_key: string;
  status: "processing" | "completed" | "skipped" | "failed";
  attempts: number;
  result_status: string | null;
  result_name: string | null;
  skip_reason: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

describe("D1SkillReflectionJobLedgerAdapter", () => {
  it("starts and completes jobs idempotently", async () => {
    const rows: SkillReflectionJobRow[] = [];
    const adapter = new D1SkillReflectionJobLedgerAdapter(fakeD1(rows));

    await expect(adapter.startJob("Ev123")).resolves.toEqual({
      status: "started",
      attempts: 1,
    });

    await adapter.completeJob("Ev123", {
      status: "created",
      name: "summarize-deployments",
    });

    await expect(adapter.startJob("Ev123")).resolves.toEqual({
      status: "already_completed",
    });
    expect(rows[0]).toMatchObject({
      status: "completed",
      result_status: "created",
      result_name: "summarize-deployments",
      last_error: null,
    });
  });

  it("records failures and allows retry attempts", async () => {
    const rows: SkillReflectionJobRow[] = [];
    const adapter = new D1SkillReflectionJobLedgerAdapter(fakeD1(rows));

    await adapter.startJob("Ev123");
    await adapter.failJob("Ev123", new Error("model unavailable"));

    await expect(adapter.startJob("Ev123")).resolves.toEqual({
      status: "started",
      attempts: 2,
    });
    expect(rows[0]).toMatchObject({
      status: "processing",
      attempts: 2,
      last_error: null,
    });
  });
});

function fakeD1(rows: SkillReflectionJobRow[]): D1Database {
  return {
    prepare(query: string) {
      return statement(query, rows);
    },
  } as unknown as D1Database;
}

function statement(query: string, rows: SkillReflectionJobRow[]) {
  return {
    bind(...values: unknown[]) {
      return executable(query, rows, values);
    },
  };
}

function executable(query: string, rows: SkillReflectionJobRow[], values: unknown[]) {
  return {
    async run() {
      if (query.includes("INSERT OR IGNORE INTO skill_reflection_jobs")) {
        const idempotencyKey = String(values[0]);

        if (!rows.some((row) => row.idempotency_key === idempotencyKey)) {
          rows.push({
            idempotency_key: idempotencyKey,
            status: "processing",
            attempts: 0,
            result_status: null,
            result_name: null,
            skip_reason: null,
            last_error: null,
            created_at: Number(values[1]),
            updated_at: Number(values[2]),
            completed_at: null,
          });
        }

        return { meta: { changes: 1 } };
      }

      if (query.includes("SET status = 'processing'")) {
        const row = rows.find((candidate) => candidate.idempotency_key === String(values[2]));

        if (row) {
          row.status = "processing";
          row.attempts = Number(values[0]);
          row.last_error = null;
          row.updated_at = Number(values[1]);
        }

        return { meta: { changes: row ? 1 : 0 } };
      }

      if (query.includes("SET status = ?")) {
        const row = rows.find((candidate) => candidate.idempotency_key === String(values[6]));

        if (row) {
          row.status = values[0] as SkillReflectionJobRow["status"];
          row.result_status = String(values[1]);
          row.result_name = values[2] === null ? null : String(values[2]);
          row.skip_reason = values[3] === null ? null : String(values[3]);
          row.last_error = null;
          row.completed_at = Number(values[4]);
          row.updated_at = Number(values[5]);
        }

        return { meta: { changes: row ? 1 : 0 } };
      }

      if (query.includes("SET status = 'failed'")) {
        const row = rows.find((candidate) => candidate.idempotency_key === String(values[2]));

        if (row) {
          row.status = "failed";
          row.last_error = String(values[0]);
          row.updated_at = Number(values[1]);
        }

        return { meta: { changes: row ? 1 : 0 } };
      }

      return { meta: { changes: 0 } };
    },
    async first() {
      return (
        rows.find((candidate) => candidate.idempotency_key === String(values[0])) ?? null
      );
    },
  };
}
