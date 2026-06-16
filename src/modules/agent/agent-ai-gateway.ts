import type { WorkersAISettings } from "workers-ai-provider";

const DEFAULT_AI_GATEWAY_ID = "default";

type WorkersAIGatewayOptions = NonNullable<WorkersAISettings["gateway"]>;

export function buildWorkersAIGatewayOptions(
  gatewayId: string | undefined,
): WorkersAIGatewayOptions {
  return {
    id: gatewayId?.trim() || DEFAULT_AI_GATEWAY_ID,
  };
}
