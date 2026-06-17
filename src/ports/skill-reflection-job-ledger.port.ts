import type { SkillReflectionResult } from "../modules/agent/skill-reflection.use-case.js";

export type StartSkillReflectionJobResult =
  | {
      status: "started";
      attempts: number;
    }
  | {
      status: "already_completed";
    };

export interface SkillReflectionJobLedgerPort {
  startJob(idempotencyKey: string): Promise<StartSkillReflectionJobResult>;
  completeJob(idempotencyKey: string, result: SkillReflectionResult): Promise<void>;
  failJob(idempotencyKey: string, error: Error): Promise<void>;
}
