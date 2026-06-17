import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

import { buildWorkersAIGatewayOptions } from "./agent-ai-gateway.js";

export const DEFAULT_WORKERS_AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";

export type SlackAgentModelOptions = {
  ai: Ai;
  aiGatewayId?: string;
  aiModel?: string;
};

export function createSlackAgentModel(options: SlackAgentModelOptions): LanguageModel {
  return createWorkersAI({
    binding: options.ai,
    gateway: buildWorkersAIGatewayOptions(options.aiGatewayId),
  })(options.aiModel ?? DEFAULT_WORKERS_AI_MODEL);
}
