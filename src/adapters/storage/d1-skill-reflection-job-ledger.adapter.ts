import type {
  SkillReflectionJobLedgerPort,
  StartSkillReflectionJobResult,
} from "../../ports/skill-reflection-job-ledger.port.js";
import type { SkillReflectionResult } from "../../modules/agent/skill-reflection.use-case.js";

type SkillReflectionJobRow = {
  status: "processing" | "completed" | "skipped" | "failed";
  attempts: number;
};

export class D1SkillReflectionJobLedgerAdapter implements SkillReflectionJobLedgerPort {
  constructor(private readonly db: D1Database) {}

  async startJob(idempotencyKey: string): Promise<StartSkillReflectionJobResult> {
    const now = Date.now();

    await this.db
      .prepare(
        `
          INSERT OR IGNORE INTO skill_reflection_jobs (
            idempotency_key,
            status,
            attempts,
            created_at,
            updated_at
          )
          VALUES (?, 'processing', 0, ?, ?)
        `,
      )
      .bind(idempotencyKey, now, now)
      .run();

    const row = await this.db
      .prepare(
        `
          SELECT status, attempts
          FROM skill_reflection_jobs
          WHERE idempotency_key = ?
          LIMIT 1
        `,
      )
      .bind(idempotencyKey)
      .first<SkillReflectionJobRow>();

    if (row?.status === "completed" || row?.status === "skipped") {
      return { status: "already_completed" };
    }

    const attempts = (row?.attempts ?? 0) + 1;

    await this.db
      .prepare(
        `
          UPDATE skill_reflection_jobs
          SET status = 'processing',
            attempts = ?,
            last_error = NULL,
            updated_at = ?
          WHERE idempotency_key = ?
        `,
      )
      .bind(attempts, now, idempotencyKey)
      .run();

    return {
      status: "started",
      attempts,
    };
  }

  async completeJob(idempotencyKey: string, result: SkillReflectionResult): Promise<void> {
    const now = Date.now();
    const status = result.status === "skipped" ? "skipped" : "completed";

    await this.db
      .prepare(
        `
          UPDATE skill_reflection_jobs
          SET status = ?,
            result_status = ?,
            result_name = ?,
            skip_reason = ?,
            last_error = NULL,
            completed_at = ?,
            updated_at = ?
          WHERE idempotency_key = ?
        `,
      )
      .bind(
        status,
        result.status,
        "name" in result ? result.name : null,
        "reason" in result ? result.reason : null,
        now,
        now,
        idempotencyKey,
      )
      .run();
  }

  async failJob(idempotencyKey: string, error: Error): Promise<void> {
    const now = Date.now();

    await this.db
      .prepare(
        `
          UPDATE skill_reflection_jobs
          SET status = 'failed',
            last_error = ?,
            updated_at = ?
          WHERE idempotency_key = ?
        `,
      )
      .bind(error.message, now, idempotencyKey)
      .run();
  }
}
