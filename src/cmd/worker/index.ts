import { routeAgentRequest } from "agents";

import { ConsoleLoggerAdapter } from "../../adapters/logger/console-logger.adapter.js";
import { D1SlackMessageHistoryAdapter } from "../../adapters/storage/d1-slack-message-history.adapter.js";
import { ThinkSessionAdapter } from "../../adapters/think/think-session.adapter.js";
import { SlackThinkAgent } from "../../modules/agent/think-agent.js";
import { HandleSlackMessageUseCase } from "../../modules/slack/handle-slack-message.use-case.js";
import { handleSlackEventRequest } from "../../modules/slack/slack.handler.js";

export { SlackThinkAgent };

export type WorkerEnv = {
  AI: Ai;
  AI_MODEL?: string;
  SLACK_THINK_AGENT: DurableObjectNamespace<SlackThinkAgent>;
  SLACK_HISTORY_DB: D1Database;
  WORKER_INTERNAL_API_TOKEN: string;
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/slack/events") {
      const logger = new ConsoleLoggerAdapter("info");
      const thinkSession = new ThinkSessionAdapter({
        agentNamespace: env.SLACK_THINK_AGENT,
      });
      const history = new D1SlackMessageHistoryAdapter(env.SLACK_HISTORY_DB);
      const useCase = new HandleSlackMessageUseCase(thinkSession, history, logger);

      return handleSlackEventRequest(request, {
        internalApiToken: env.WORKER_INTERNAL_API_TOKEN,
        useCase,
        logger,
      });
    }

    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", {
        status: 404,
      })
    );
  },
} satisfies ExportedHandler<WorkerEnv>;
