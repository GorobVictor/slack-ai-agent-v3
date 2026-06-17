import { describe, expect, it } from "vitest";

import {
  buildExistingSkillsCatalogPrompt,
  buildSkillReflectionPrompt,
  buildSkillReflectionSystemPrompt,
  SKILL_REFLECTION_OUTPUT_DESCRIPTION,
  SKILL_REFLECTION_OUTPUT_NAME,
} from "./skill-reflection.prompts.js";

describe("skill reflection prompts", () => {
  it("keeps generated skill policy guidance in the system prompt", () => {
    const prompt = buildSkillReflectionSystemPrompt();

    expect(prompt).toContain("lowercase kebab-case");
    expect(prompt).toContain("getSlackHistoryContext");
  });

  it("includes the current message, assistant reply, history, and catalog", () => {
    const prompt = buildSkillReflectionPrompt({
      event: {
        source: "slack",
        teamId: "T123",
        channelId: "C123",
        userId: "U123",
        text: "Can you summarize recurring blockers?",
        messageTs: "1710000000.000100",
        channelType: "channel",
        isMention: true,
        isThreadMessage: false,
        idempotencyKey: "slack:T123:C123:1710000000.000100",
        processingIntent: "invoke",
      },
      assistantReply: "Here is the summary.",
      historyContext: "[1710000000.000100] <@U123>: hello",
      existingSkillsCatalog: "name: summarize-recurring-blockers",
    });

    expect(prompt).toContain("Current user message:");
    expect(prompt).toContain("Here is the summary.");
    expect(prompt).toContain("name: summarize-recurring-blockers");
    expect(prompt).toContain("Return compact JSON only");
    expect(prompt).toContain("at most 5 items");
  });

  it("formats the existing generated skill catalog", () => {
    expect(
      buildExistingSkillsCatalogPrompt([
        {
          id: "skill-1",
          name: "summarize-recurring-blockers",
          description: "Summarize blockers. Use when users ask about repeated blockers.",
          body: "## Goal\n\nSummarize blockers.",
          bodyJson: {
            goal: "Summarize blockers.",
            triggers: ["Use when users ask about repeated blockers."],
            instructions: ["Read context."],
          },
          allowedTools: "getSlackHistoryContext",
          version: 1,
          isOld: false,
          disabled: false,
          confidence: 0.95,
          autoApprovalReason: "Reusable workflow.",
          createdAt: 1710000000000,
          updatedAt: 1710000000000,
        },
      ]),
    ).toContain("goal: Summarize blockers.");
  });

  it("exports structured output metadata", () => {
    expect(SKILL_REFLECTION_OUTPUT_NAME).toBe("SkillReflectionDecision");
    expect(SKILL_REFLECTION_OUTPUT_DESCRIPTION).toContain("generated reusable skills");
  });
});
