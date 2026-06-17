import { getAgentByName } from "agents";

import type {
  SubmitSlackMessageToThinkInput,
  ThinkSessionStreamCallbacks,
  ThinkSessionPort,
  ThinkSessionReply,
} from "../../ports/think-session.port.js";
import type { SlackThinkAgent } from "../../modules/agent/think-agent.js";

export type ThinkSessionAdapterOptions = {
  agentNamespace: DurableObjectNamespace<SlackThinkAgent>;
};

export class ThinkSessionAdapter implements ThinkSessionPort {
  constructor(private readonly options: ThinkSessionAdapterOptions) {}

  async submitSlackMessage(
    input: SubmitSlackMessageToThinkInput,
  ): Promise<ThinkSessionReply> {
    const agent = await getAgentByName(this.options.agentNamespace, input.sessionId);
    const result = await agent.runSlackTurn({
      event: input.event,
    });

    return {
      text: result.text,
    };
  }

  async streamSlackMessage(
    input: SubmitSlackMessageToThinkInput,
    callbacks: ThinkSessionStreamCallbacks,
  ): Promise<ThinkSessionReply> {
    const agent = await getAgentByName(this.options.agentNamespace, input.sessionId);
    const result = await agent.runSlackTurnStream(
      {
        event: input.event,
      },
      callbacks,
    );

    return {
      text: result.text,
    };
  }
}
