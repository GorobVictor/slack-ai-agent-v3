import { describe, expect, it } from "vitest";

import { buildWorkersAIGatewayOptions } from "./agent-ai-gateway.js";
import {
  DEFAULT_REFLECTION_AI_MODEL,
  FAST_REFLECTION_AI_MODEL_FALLBACK,
  readReflectionModel,
} from "./agent-model.js";

describe("buildWorkersAIGatewayOptions", () => {
  it("uses the default Cloudflare AI Gateway when no gateway is configured", () => {
    expect(buildWorkersAIGatewayOptions(undefined)).toEqual({
      id: "default",
    });
  });

  it("trims configured AI Gateway IDs", () => {
    expect(buildWorkersAIGatewayOptions("  slack-agent-gateway  ")).toEqual({
      id: "slack-agent-gateway",
    });
  });

  it("falls back to the default gateway for blank values", () => {
    expect(buildWorkersAIGatewayOptions("   ")).toEqual({
      id: "default",
    });
  });
});

describe("readReflectionModel", () => {
  it("uses the dedicated reflection model when configured", () => {
    expect(
      readReflectionModel({
        ai: {} as Ai,
        aiModel: "@cf/google/gemma-4-26b-a4b-it",
        reflectionAiModel: FAST_REFLECTION_AI_MODEL_FALLBACK,
      }),
    ).toBe(FAST_REFLECTION_AI_MODEL_FALLBACK);
  });

  it("falls back to the main model when only AI_MODEL is configured", () => {
    expect(
      readReflectionModel({
        ai: {} as Ai,
        aiModel: "@cf/custom/main-model",
      }),
    ).toBe("@cf/custom/main-model");
  });

  it("defaults reflection to Gemma 4 for cost continuity", () => {
    expect(
      readReflectionModel({
        ai: {} as Ai,
      }),
    ).toBe(DEFAULT_REFLECTION_AI_MODEL);
  });
});
