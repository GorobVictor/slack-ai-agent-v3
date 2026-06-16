import { describe, expect, it } from "vitest";

import { buildWorkersAIGatewayOptions } from "./agent-ai-gateway.js";

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
