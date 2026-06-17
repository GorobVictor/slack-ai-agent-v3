import { Think, type SkillSource } from "@cloudflare/think";
import { type LanguageModel, type ToolSet, type UIMessage } from "ai";

import { D1GeneratedSkillAdapter } from "../../adapters/storage/d1-generated-skill.adapter.js";
import { D1SlackMessageHistoryAdapter } from "../../adapters/storage/d1-slack-message-history.adapter.js";
import {
  buildSlackAgentSystemPrompt,
  buildSlackUserMessagePrompt,
} from "../../prompts/agent.prompts.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";
import { createSlackAgentModel } from "./agent-model.js";
import { createSlackAgentSkillSources } from "./agent.skills.js";
import { createSlackAgentTools } from "./agent.tools.js";
import type {
  RunSlackTurnInput,
  RunSlackTurnResult,
  SlackThinkAgentEnv,
} from "./agent.types.js";

export class SlackThinkAgent extends Think<SlackThinkAgentEnv> {
  override workspaceBash = false;
  private activeSlackEvent: SlackWorkerRequest | null = null;

  override getModel(): LanguageModel {
    return createSlackAgentModel({
      ai: this.env.AI,
      aiGatewayId: this.env.AI_GATEWAY_ID,
      aiModel: this.env.AI_MODEL,
    });
  }

  override getSystemPrompt(): string {
    return buildSlackAgentSystemPrompt();
  }

  override getSkills(): SkillSource[] {
    return createSlackAgentSkillSources(
      new D1GeneratedSkillAdapter(this.env.SLACK_HISTORY_DB),
    );
  }

  override getTools(): ToolSet {
    return createSlackAgentTools({
      history: new D1SlackMessageHistoryAdapter(this.env.SLACK_HISTORY_DB),
      getActiveSlackEvent: () => this.activeSlackEvent,
    });
  }

  async runSlackTurn(input: RunSlackTurnInput): Promise<RunSlackTurnResult> {
    this.ensureSlackTurnLedger();

    const existingReply = this.readCachedSlackTurnReply(input.event.idempotencyKey);

    if (existingReply) {
      return { text: existingReply };
    }

    const beforeMessageIds = new Set(this.messages.map((message) => message.id));
    this.activeSlackEvent = input.event;
    const result = await (async () => {
      try {
        return await this.saveMessages([
          {
            id: `slack-${input.event.idempotencyKey}`,
            role: "user",
            parts: [{ type: "text", text: buildSlackUserMessagePrompt(input.event) }],
          },
        ]);
      } finally {
        this.activeSlackEvent = null;
      }
    })();

    if (result.status !== "completed") {
      throw new Error(`Think turn did not complete: ${result.status}`);
    }

    const replyText = extractLatestAssistantText(await this.getMessages(), beforeMessageIds);

    if (!replyText) {
      throw new Error("Think turn completed without an assistant text reply");
    }

    this.cacheSlackTurnReply(input.event.idempotencyKey, replyText);

    return { text: replyText };
  }

  private ensureSlackTurnLedger(): void {
    this.sql`
      CREATE TABLE IF NOT EXISTS slack_turn_replies (
        idempotency_key TEXT PRIMARY KEY,
        reply_text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `;
  }

  private readCachedSlackTurnReply(idempotencyKey: string): string | null {
    const rows = this.sql<{ reply_text: string }>`
      SELECT reply_text
      FROM slack_turn_replies
      WHERE idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;

    return rows[0]?.reply_text ?? null;
  }

  private cacheSlackTurnReply(idempotencyKey: string, replyText: string): void {
    this.sql`
      INSERT OR REPLACE INTO slack_turn_replies (idempotency_key, reply_text, created_at)
      VALUES (${idempotencyKey}, ${replyText}, ${Date.now()})
    `;
  }
}

function extractLatestAssistantText(messages: UIMessage[], beforeMessageIds: Set<string>): string {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant" || beforeMessageIds.has(message.id)) {
      continue;
    }

    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
}
