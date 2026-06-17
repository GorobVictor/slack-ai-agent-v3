import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

import { buildWorkersAIGatewayOptions } from "./agent-ai-gateway.js";

type WorkersAIChatSettings = NonNullable<Parameters<ReturnType<typeof createWorkersAI>>[1]>;

const DEFAULT_WORKERS_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const DEFAULT_REFLECTION_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";

export type SlackAgentModelOptions = {
  ai: Ai;
  aiGatewayId?: string;
  aiModel?: string;
};

export type SkillReflectionModelOptions = SlackAgentModelOptions & {
  reflectionAiModel?: string;
};

export function createSlackAgentModel(options: SlackAgentModelOptions): LanguageModel {
  const workersAI = createWorkersAI({
    binding: options.ai,
    gateway: buildWorkersAIGatewayOptions(options.aiGatewayId),
  });

  return workersAI(
    (options.aiModel ?? DEFAULT_WORKERS_AI_MODEL) as Parameters<typeof workersAI>[0],
  );
}

export function createSkillReflectionModel(
  options: SkillReflectionModelOptions,
): LanguageModel {
  const workersAI = createWorkersAI({
    binding: options.ai,
    gateway: buildWorkersAIGatewayOptions(options.aiGatewayId),
  });

  return workersAI(
    readReflectionModel(options) as Parameters<typeof workersAI>[0],
    reflectionModelSettings(),
  );
}

export function readReflectionModel(options: SkillReflectionModelOptions): string {
  return options.reflectionAiModel ?? options.aiModel ?? DEFAULT_REFLECTION_AI_MODEL;
}

function reflectionModelSettings(): WorkersAIChatSettings {
  return {
    reasoning_effort: null,
    chat_template_kwargs: {
      enable_thinking: false,
      clear_thinking: true,
    },
  };
}
