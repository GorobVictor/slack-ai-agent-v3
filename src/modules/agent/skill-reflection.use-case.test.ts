import { describe, expect, it } from "vitest";

import { InMemoryGeneratedSkillAdapter } from "../../adapters/storage/in-memory-generated-skill.adapter.js";
import { InMemorySlackMessageHistoryAdapter } from "../../adapters/storage/in-memory-slack-message-history.adapter.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";
import type { GeneratedSkillCandidate } from "./generated-skill-policy.js";
import { ReflectOnSlackConversationForSkillUseCase } from "./skill-reflection.use-case.js";

describe("ReflectOnSlackConversationForSkillUseCase", () => {
  it("stores an approved generated skill", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter();
    const currentEvent = event();
    await history.saveMessage(currentEvent);

    const result = await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async () => candidate(),
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
    });
  });

  it("skips weak candidates", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    const skills = new InMemoryGeneratedSkillAdapter();
    const currentEvent = event();
    await history.saveMessage(currentEvent);

    const result = await new ReflectOnSlackConversationForSkillUseCase({
      history,
      skills,
      generateCandidate: async () =>
        candidate({
          shouldCreate: false,
          confidence: 0.1,
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
});

function candidate(overrides: Partial<GeneratedSkillCandidate> = {}): GeneratedSkillCandidate {
  return {
    shouldCreate: true,
    name: "summarize-recurring-blockers",
    description:
      "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers or unresolved follow-ups.",
    body: "Review recent context, group repeated blockers, identify owners when explicit, and avoid inventing missing details.",
    allowedTools: "getSlackHistoryContext",
    confidence: 0.95,
    reason: "The conversation showed a reusable summary workflow.",
    ...overrides,
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
