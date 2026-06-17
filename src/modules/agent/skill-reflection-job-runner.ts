import type { LanguageModel } from "ai";

import type { GeneratedSkillPort } from "../../ports/generated-skill.port.js";
import type { LoggerPort } from "../../ports/logger.port.js";
import type { SkillReflectionJobLedgerPort } from "../../ports/skill-reflection-job-ledger.port.js";
import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import type { SkillReflectionJob } from "./skill-reflection-job.js";
import {
  createModelSkillReflectionCandidateGenerator,
  ReflectOnSlackConversationForSkillUseCase,
  type SkillReflectionResult,
} from "./skill-reflection.use-case.js";

export type RunSkillReflectionJobOptions = {
  job: SkillReflectionJob;
  history: SlackMessageHistoryPort;
  skills: GeneratedSkillPort;
  ledger: SkillReflectionJobLedgerPort;
  model: LanguageModel;
  logger?: LoggerPort;
};

export type RunSkillReflectionJobResult =
  | {
      status: "completed";
      result: SkillReflectionResult;
    }
  | {
      status: "already_completed";
    };

export async function runSkillReflectionJob(
  options: RunSkillReflectionJobOptions,
): Promise<RunSkillReflectionJobResult> {
  const startResult = await options.ledger.startJob(options.job.idempotencyKey);

  if (startResult.status === "already_completed") {
    options.logger?.info("[gen-skills] Skill reflection job already completed", {
      idempotencyKey: options.job.idempotencyKey,
    });

    return { status: "already_completed" };
  }

  try {
    const result = await new ReflectOnSlackConversationForSkillUseCase({
      history: options.history,
      skills: options.skills,
      generateCandidate: createModelSkillReflectionCandidateGenerator(options.model),
      logger: options.logger,
      throwOnError: true,
    }).execute({
      event: options.job.event,
      assistantReply: options.job.assistantReply,
    });

    await options.ledger.completeJob(options.job.idempotencyKey, result);

    options.logger?.info("[gen-skills] Skill reflection job completed", {
      idempotencyKey: options.job.idempotencyKey,
      resultStatus: result.status,
      resultName: "name" in result ? result.name : undefined,
    });

    return {
      status: "completed",
      result,
    };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error("Skill reflection failed.");

    await options.ledger.failJob(options.job.idempotencyKey, normalizedError);
    throw normalizedError;
  }
}
