import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import type { GeneratedSkillPort } from "../../ports/generated-skill.port.js";
import type { LoggerPort } from "../../ports/logger.port.js";
import type { SlackMessageHistoryPort } from "../../ports/slack-message-history.port.js";
import {
  GENERATED_SKILL_ALLOWED_TOOL,
} from "../../prompts/generated-skills.prompts.js";
import {
  buildExistingSkillsCatalogPrompt,
  buildSkillReflectionPrompt,
  buildSkillReflectionSystemPrompt,
  SKILL_REFLECTION_OUTPUT_DESCRIPTION,
  SKILL_REFLECTION_OUTPUT_NAME,
} from "../../prompts/skill-reflection.prompts.js";
import {
  BuildSlackHistoryContextUseCase,
  type SlackHistorySummaryScope,
} from "../slack/slack-history-summary.use-case.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";
import {
  type SkillReflectionDecision,
  validateGeneratedSkillCandidate,
} from "./generated-skill-policy.js";

const generatedSkillBodySchema = z.object({
  goal: z.string(),
  triggers: z.array(z.string()),
  instructions: z.array(z.string()),
  safetyNotes: z.array(z.string()).optional(),
  toolUsage: z
    .array(
      z.object({
        tool: z.literal(GENERATED_SKILL_ALLOWED_TOOL),
        when: z.string(),
      }),
    )
    .optional(),
});

const typedSkillCandidateSchema = z.object({
  name: z.string(),
  description: z.string(),
  body: generatedSkillBodySchema,
  allowedTools: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

const skillReflectionDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("skip"),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    action: z.literal("create"),
    candidate: typedSkillCandidateSchema,
  }),
  z.object({
    action: z.literal("update"),
    existingSkillName: z.string(),
    candidate: typedSkillCandidateSchema,
  }),
]);

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
  existingSkillsCatalog: string;
};

export type SkillReflectionCandidateGenerator = (
  input: SkillReflectionCandidateGeneratorInput,
) => Promise<SkillReflectionDecision>;

export type SkillReflectionUseCaseOptions = {
  history: SlackMessageHistoryPort;
  skills: GeneratedSkillPort;
  generateCandidate: SkillReflectionCandidateGenerator;
  logger?: LoggerPort;
  throwOnError?: boolean;
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

      const existingSkills = await this.options.skills.listEnabledSkills();
      const existingSkillsCatalog = buildExistingSkillsCatalogPrompt(existingSkills);

      this.options.logger?.info("[gen-skills] Existing skill catalog loaded", {
        existingSkillCount: existingSkills.length,
      });

      const decision = await this.options.generateCandidate({
        ...input,
        historyContext,
        existingSkillsCatalog,
      });

      this.options.logger?.info("[gen-skills] Skill decision generated", {
        action: decision.action,
        name: readDecisionName(decision),
        existingSkillName: decision.action === "update" ? decision.existingSkillName : undefined,
        confidence: readDecisionConfidence(decision),
        allowedTools: readDecisionAllowedTools(decision),
        bodyJsonLength: readDecisionBodyLength(decision),
      });

      const policyResult = validateGeneratedSkillCandidate(decision);

      if (policyResult.status === "rejected") {
        this.options.logger?.info("[gen-skills] Skill candidate rejected", {
          action: decision.action,
          name: readDecisionName(decision),
          confidence: readDecisionConfidence(decision),
          reason: policyResult.reason,
        });

        return {
          status: "skipped",
          reason: policyResult.reason,
        };
      }

      const saveResult = await this.options.skills.saveAutoApprovedSkillDecision(
        policyResult.decision,
      );

      if (!saveResult.skill) {
        this.options.logger?.warn("[gen-skills] Skill save returned no skill", {
          saveStatus: saveResult.status,
          name: policyResult.decision.candidate.name,
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
        isOld: saveResult.skill.isOld,
        disabled: saveResult.skill.disabled,
      });

      return {
        status: saveResult.status === "inserted" ? "created" : saveResult.status,
        name: saveResult.skill.name,
      };
    } catch (error) {
      if (this.options.throwOnError) {
        throw error;
      }

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
    const result = await generateText({
      model,
      output: Output.object({
        schema: skillReflectionDecisionSchema,
        name: SKILL_REFLECTION_OUTPUT_NAME,
        description: SKILL_REFLECTION_OUTPUT_DESCRIPTION,
      }),
      system: buildSkillReflectionSystemPrompt(),
      prompt: buildSkillReflectionPrompt(input),
    });

    return result.output;
  };
}

function resolveReflectionHistoryScope(event: SlackWorkerRequest): SlackHistorySummaryScope {
  return event.channelType === "im" ? "channel" : "thread";
}

function readDecisionName(decision: SkillReflectionDecision): string | undefined {
  return decision.action === "skip" ? undefined : decision.candidate.name;
}

function readDecisionConfidence(decision: SkillReflectionDecision): number {
  return decision.action === "skip" ? decision.confidence : decision.candidate.confidence;
}

function readDecisionAllowedTools(decision: SkillReflectionDecision): string | undefined {
  return decision.action === "skip" ? undefined : decision.candidate.allowedTools;
}

function readDecisionBodyLength(decision: SkillReflectionDecision): number {
  return decision.action === "skip" ? 0 : JSON.stringify(decision.candidate.body).length;
}
