import { describe, expect, it } from "vitest";

import { InMemoryGeneratedSkillAdapter } from "../../adapters/storage/in-memory-generated-skill.adapter.js";
import { InMemorySlackMessageHistoryAdapter } from "../../adapters/storage/in-memory-slack-message-history.adapter.js";
import type { GeneratedSkill } from "../../ports/generated-skill.port.js";
import type {
  SlackMessageHistoryPort,
  SlackThreadHistoryTimeRange,
} from "../../ports/slack-message-history.port.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";
import type { SkillReflectionDecision } from "./generated-skill-policy.js";
import {
  ReflectOnSlackConversationForSkillUseCase,
  SKILL_REFLECTION_HISTORY_LIMIT,
} from "./skill-reflection.use-case.js";

describe("ReflectOnSlackConversationForSkillUseCase", () => {
  it("stores a create decision as version 1", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter();
    const currentEvent = event();
    await history.saveMessage(currentEvent);

    const result = await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async () => createDecision(),
    }).execute({
      event: currentEvent,
      assistantReply: "Here is a concise blocker summary.",
    });

    expect(result).toEqual({
      status: "created",
      name: "summarize-recurring-blockers",
    });
    await expect(skills.loadEnabledSkill("summarize-recurring-blockers")).resolves.toMatchObject({
      name: "summarize-recurring-blockers",
      version: 1,
      isOld: false,
    });
  });

  it("updates an existing skill by creating a new version", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter([existingSkill()]);
    const currentEvent = event();
    await history.saveMessage(currentEvent);

    const result = await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async () => updateDecision(),
    }).execute({
      event: currentEvent,
      assistantReply: "Here is an improved blocker summary.",
    });

    expect(result).toEqual({
      status: "updated",
      name: "summarize-recurring-blockers",
    });
    await expect(skills.loadEnabledSkill("summarize-recurring-blockers")).resolves.toMatchObject({
      version: 2,
      isOld: false,
    });
  });

  it("passes existing skill catalog to the candidate generator", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter([existingSkill()]);
    const currentEvent = event();
    await history.saveMessage(currentEvent);
    let catalog = "";

    await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async (input) => {
        catalog = input.existingSkillsCatalog;
        return { action: "skip", confidence: 0.9, reason: "Already covered." };
      },
    }).execute({
      event: currentEvent,
      assistantReply: "Done.",
    });

    expect(catalog).toContain("name: summarize-recurring-blockers");
    expect(catalog).toContain("version: 1");
  });

  it("uses the reduced reflection history limit", async () => {
    let query: SlackThreadHistoryTimeRange | null = null;
    const currentEvent = event();

    await new ReflectOnSlackConversationForSkillUseCase({
      history: {
        async saveMessage() {
          return { status: "inserted" };
        },
        async findMessagesByChannelAndTimeRange() {
          return [];
        },
        async findMessagesByThreadAndTimeRange(input) {
          query = input;
          return [];
        },
        async findThreadMessagesByChannelAndTimeRange() {
          return [];
        },
      } satisfies SlackMessageHistoryPort,
      skills: new InMemoryGeneratedSkillAdapter(),
      generateCandidate: async () => ({
        action: "skip",
        confidence: 0.9,
        reason: "No reusable pattern.",
      }),
    }).execute({
      event: currentEvent,
      assistantReply: "Done.",
    });

    const capturedQuery = query as SlackThreadHistoryTimeRange | null;

    expect(capturedQuery).toMatchObject({
      limit: SKILL_REFLECTION_HISTORY_LIMIT,
      threadTs: currentEvent.messageTs,
    });
    expect(capturedQuery?.sinceTs).toBe("1709740800.000200");
  });

  it("still sends greeting-only turns to the candidate generator", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter();
    const currentEvent = event({
      text: "<@U0B54L53T5H> hey man",
    });
    await history.saveMessage(currentEvent);
    let called = false;

    await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async () => {
        called = true;
        return {
          action: "skip",
          confidence: 0.99,
          reason: "Greeting only.",
        };
      },
    }).execute({
      event: currentEvent,
      assistantReply: "Hey! How can I help you?",
    });

    expect(called).toBe(true);
  });

  it("skips weak decisions", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter();
    const currentEvent = event();
    await history.saveMessage(currentEvent);

    const result = await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async () => ({
        action: "skip",
        confidence: 0.1,
        reason: "No reusable pattern.",
      }),
    }).execute({
      event: currentEvent,
      assistantReply: "Done.",
    });

    expect(result.status).toBe("skipped");
    await expect(skills.listEnabledSkills()).resolves.toEqual([]);
  });

  it("does not throw when candidate generation fails", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter();
    const currentEvent = event();
    await history.saveMessage(currentEvent);

    const result = await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async () => {
        throw new Error("model unavailable");
      },
    }).execute({
      event: currentEvent,
      assistantReply: "Done.",
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "model unavailable",
    });
  });

  it("throws candidate generation failures when strict error handling is enabled", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter();
    const currentEvent = event();
    await history.saveMessage(currentEvent);

    await expect(
      new ReflectOnSlackConversationForSkillUseCase({
        history,
        skills,
        generateCandidate: async () => {
          throw new Error("model unavailable");
        },
        throwOnError: true,
      }).execute({
        event: currentEvent,
        assistantReply: "Done.",
      }),
    ).rejects.toThrow("model unavailable");
  });
});

function createDecision(): SkillReflectionDecision {
  return {
    action: "create",
    candidate: {
      name: "summarize-recurring-blockers",
      description:
        "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers or unresolved follow-ups.",
      body: {
        goal: "Summarize recurring blockers from recent discussion.",
        triggers: ["Use when users ask about repeated blockers or unresolved follow-ups."],
        instructions: [
          "Review recent context.",
          "Group repeated blockers.",
          "Identify owners when explicit.",
          "Avoid inventing missing details.",
        ],
      },
      allowedTools: "getSlackHistoryContext",
      confidence: 0.95,
      reason: "The conversation showed a reusable summary workflow.",
    },
  };
}

function updateDecision(): SkillReflectionDecision {
  const currentCandidate = createCandidate();

  return {
    action: "update",
    existingSkillName: "summarize-recurring-blockers",
    candidate: {
      ...currentCandidate,
      body: {
        goal: "Summarize recurring blockers from recent discussion.",
        triggers: ["Use when users ask about repeated blockers or unresolved follow-ups."],
        instructions: [
          "Review recent context.",
          "Group repeated blockers by topic.",
          "Identify explicit owners only.",
          "Avoid inventing missing details.",
        ],
      },
      reason: "The new conversation improved the blocker summary workflow.",
    },
  };
}

function createCandidate() {
  const decision = createDecision();
  return decision.action === "create" ? decision.candidate : neverCreateDecision();
}

function neverCreateDecision(): never {
  throw new Error("Expected create decision.");
}

function existingSkill(): GeneratedSkill {
  return {
    id: "skill-1",
    name: "summarize-recurring-blockers",
    description:
      "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers or unresolved follow-ups.",
    body: "## Goal\n\nSummarize recurring blockers from recent discussion.",
    bodyJson: {
      goal: "Summarize recurring blockers from recent discussion.",
      triggers: ["Use when users ask about repeated blockers or unresolved follow-ups."],
      instructions: ["Review recent context.", "Group repeated blockers."],
    },
    allowedTools: "getSlackHistoryContext",
    version: 1,
    isOld: false,
    disabled: false,
    confidence: 0.95,
    autoApprovalReason: "Reusable workflow.",
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
  };
}

function event(overrides: Partial<SlackWorkerRequest> = {}): SlackWorkerRequest {
  return {
    source: "slack",
    teamId: "T123",
    channelId: "C123",
    userId: "U123",
    text: "Can you summarize recurring blockers?",
    messageTs: "1710000000.000200",
    channelType: "channel",
    isMention: true,
    isThreadMessage: false,
    idempotencyKey: "slack:T123:C123:1710000000.000200",
    processingIntent: "invoke",
    ...overrides,
  };
}
