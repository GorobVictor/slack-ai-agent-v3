import { routeAgentRequest } from "agents";

import { CloudflareSkillReflectionQueueAdapter } from "../../adapters/cloudflare/cloudflare-skill-reflection-queue.adapter.js";
import { ConsoleLoggerAdapter } from "../../adapters/logger/console-logger.adapter.js";
import { D1GeneratedSkillAdapter } from "../../adapters/storage/d1-generated-skill.adapter.js";
import { D1SkillReflectionJobLedgerAdapter } from "../../adapters/storage/d1-skill-reflection-job-ledger.adapter.js";
import { D1SlackMessageHistoryAdapter } from "../../adapters/storage/d1-slack-message-history.adapter.js";
import { ThinkSessionAdapter } from "../../adapters/think/think-session.adapter.js";
import {
  createSkillReflectionModel,
  readReflectionModel,
} from "../../modules/agent/agent-model.js";
import {
  parseSkillReflectionJob,
  type SkillReflectionJob,
} from "../../modules/agent/skill-reflection-job.js";
import { runSkillReflectionJob } from "../../modules/agent/skill-reflection-job-runner.js";
import { SlackThinkAgent } from "../../modules/agent/think-agent.js";
import { HandleSlackMessageUseCase } from "../../modules/slack/handle-slack-message.use-case.js";
import { handleSlackEventRequest } from "../../modules/slack/slack.handler.js";

export { SlackThinkAgent };

export type WorkerEnv = {
  AI: Ai;
  AI_GATEWAY_ID?: string;
  AI_MODEL?: string;
  REFLECTION_AI_MODEL?: string;
  SLACK_THINK_AGENT: DurableObjectNamespace<SlackThinkAgent>;
  SLACK_HISTORY_DB: D1Database;
  SKILL_REFLECTION_QUEUE: Queue<SkillReflectionJob>;
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
      const skillReflectionQueue = new CloudflareSkillReflectionQueueAdapter(
        env.SKILL_REFLECTION_QUEUE,
      );
      const useCase = new HandleSlackMessageUseCase(
        thinkSession,
        history,
        logger,
        skillReflectionQueue,
      );

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

  async queue(batch: MessageBatch<unknown>, env: WorkerEnv): Promise<void> {
    const logger = new ConsoleLoggerAdapter("info");
    const history = new D1SlackMessageHistoryAdapter(env.SLACK_HISTORY_DB);
    const skills = new D1GeneratedSkillAdapter(env.SLACK_HISTORY_DB);
    const ledger = new D1SkillReflectionJobLedgerAdapter(env.SLACK_HISTORY_DB);
    const modelOptions = {
      ai: env.AI,
      aiGatewayId: env.AI_GATEWAY_ID,
      aiModel: env.AI_MODEL,
      reflectionAiModel: env.REFLECTION_AI_MODEL,
    };
    const model = createSkillReflectionModel(modelOptions);
    const modelName = readReflectionModel(modelOptions);

    for (const message of batch.messages) {
      const job = parseSkillReflectionJob(message.body);

      if (!job) {
        logger.warn("Discarding invalid skill reflection queue message", {
          messageId: message.id,
          attempts: message.attempts,
        });
        message.ack();
        continue;
      }

      try {
        await runSkillReflectionJob({
          job,
          history,
          skills,
          ledger,
          model,
          modelName,
          logger,
        });
        message.ack();
      } catch (error) {
        logger.error("Skill reflection queue message failed", {
          messageId: message.id,
          attempts: message.attempts,
          idempotencyKey: job.idempotencyKey,
          modelName,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        message.retry({
          delaySeconds: readSkillReflectionRetryDelaySeconds(message.attempts),
        });
      }
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

function readSkillReflectionRetryDelaySeconds(attempts: number): number {
  return Math.min(300, Math.max(5, attempts * 30));
}
