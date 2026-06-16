import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import type { GeneratedSkillPort } from "../../ports/generated-skill.port.js";
import type { LoggerPort } from "../../ports/logger.port.js";
import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import {
  BuildSlackHistoryContextUseCase,
  type SlackHistorySummaryScope,
} from "../slack/slack-history-summary.use-case.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";
import {
  type GeneratedSkillCandidate,
  validateGeneratedSkillCandidate,
} from "./generated-skill-policy.js";
import {
  buildSkillReflectionPrompt,
  buildSkillReflectionSystemPrompt,
} from "./skill-reflection.prompts.js";

const skillReflectionCandidateSchema = z.object({
  shouldCreate: z.boolean(),
  name: z.string(),
  description: z.string(),
  body: z.string(),
  allowedTools: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export type SkillReflectionInput = {
  event: SlackWorkerRequest;
  assistantReply: string;
};

export type SkillReflectionResult =
  | {
      status: "created" | "updated" | "unchanged" | "skipped_disabled";
      name: string;
    }
  | {
      status: "skipped";
      reason: string;
    };

export type SkillReflectionCandidateGeneratorInput = SkillReflectionInput & {
  historyContext: string;
};

export type SkillReflectionCandidateGenerator = (
  input: SkillReflectionCandidateGeneratorInput,
) => Promise<GeneratedSkillCandidate>;

export type SkillReflectionUseCaseOptions = {
  history: SlackMessageHistoryPort;
  skills: GeneratedSkillPort;
  generateCandidate: SkillReflectionCandidateGenerator;
  logger?: LoggerPort;
};

export class ReflectOnSlackConversationForSkillUseCase {
  constructor(private readonly options: SkillReflectionUseCaseOptions) {}

  async execute(input: SkillReflectionInput): Promise<SkillReflectionResult> {
    try {
      this.options.logger?.info("[gen-skills] Skill reflection started", {
        teamId: input.event.teamId,
        channelId: input.event.channelId,
        threadTs: input.event.threadTs,
        messageTs: input.event.messageTs,
        channelType: input.event.channelType,
      });

      const historyContext = await new BuildSlackHistoryContextUseCase(
        this.options.history,
      ).execute({
        currentEvent: input.event,
        scope: resolveReflectionHistoryScope(input.event),
        days: 14,
        threadTs: input.event.threadTs ?? input.event.messageTs,
      });

      this.options.logger?.info("[gen-skills] Reflection context loaded", {
        historyContextLength: historyContext.length,
      });

      const candidate = await this.options.generateCandidate({
        ...input,
        historyContext,
      });

      this.options.logger?.info("[gen-skills] Skill candidate generated", {
        shouldCreate: candidate.shouldCreate,
        name: candidate.name || undefined,
        confidence: candidate.confidence,
        allowedTools: candidate.allowedTools,
        bodyLength: candidate.body.length,
      });

      const policyResult = validateGeneratedSkillCandidate(candidate);

      if (policyResult.status === "rejected") {
        this.options.logger?.info("[gen-skills] Skill candidate rejected", {
          name: candidate.name || undefined,
          confidence: candidate.confidence,
          reason: policyResult.reason,
        });

        return {
          status: "skipped",
          reason: policyResult.reason,
        };
      }

      const saveResult = await this.options.skills.upsertAutoApprovedSkill(
        policyResult.skill,
      );

      if (!saveResult.skill) {
        this.options.logger?.warn("[gen-skills] Skill save returned no skill", {
          saveStatus: saveResult.status,
          name: policyResult.skill.name,
        });

        return {
          status: "skipped",
          reason: `Generated skill save returned ${saveResult.status}.`,
        };
      }

      this.options.logger?.info("[gen-skills] Skill reflection saved", {
        status: saveResult.status === "inserted" ? "created" : saveResult.status,
        name: saveResult.skill.name,
        version: saveResult.skill.version,
        disabled: saveResult.skill.disabled,
      });

      return {
        status: saveResult.status === "inserted" ? "created" : saveResult.status,
        name: saveResult.skill.name,
      };
    } catch (error) {
      this.options.logger?.warn("[gen-skills] Skill reflection failed", {
        reason: error instanceof Error ? error.message : "Skill reflection failed.",
      });

      return {
        status: "skipped",
        reason: error instanceof Error ? error.message : "Skill reflection failed.",
      };
    }
  }
}

export function createModelSkillReflectionCandidateGenerator(
  model: LanguageModel,
): SkillReflectionCandidateGenerator {
  return async (input) => {
    const result = await generateObject({
      model,
      schema: skillReflectionCandidateSchema,
      schemaName: "SkillReflectionCandidate",
      schemaDescription: "A reusable generated skill candidate, or a decision not to create one.",
      system: buildSkillReflectionSystemPrompt(),
      prompt: buildSkillReflectionPrompt(input),
    });

    return result.object;
  };
}

function resolveReflectionHistoryScope(event: SlackWorkerRequest): SlackHistorySummaryScope {
  return event.channelType === "im" ? "channel" : "thread";
}
