import { describe, expect, it } from "vitest";

import {
  type SkillReflectionDecision,
  type TypedGeneratedSkillCandidate,
  validateGeneratedSkillCandidate,
} from "./generated-skill-policy.js";

describe("validateGeneratedSkillCandidate", () => {
  it("approves a universal reusable skill", () => {
    const result = validateGeneratedSkillCandidate(candidate());

    expect(result).toMatchObject({
      status: "approved",
      decision: {
        action: "create",
        candidate: {
          name: "summarize-recurring-blockers",
          allowedTools: "getSlackHistoryContext",
        },
      },
    });
  });

  it("normalizes harmless generated names to kebab-case", () => {
    const result = validateGeneratedSkillCandidate(
      candidate({
        name: "code_only_mode_with_safety_check",
      }),
    );

    expect(result).toMatchObject({
      status: "approved",
      decision: {
        candidate: {
          name: "code-only-mode-with-safety-check",
        },
      },
    });
  });

  it("rejects low-confidence candidates", () => {
    const result = validateGeneratedSkillCandidate(candidate({ confidence: 0.5 }));

    expect(result).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining("confidence"),
    });
  });

  it("adds a default trigger to descriptions without Use when", () => {
    const result = validateGeneratedSkillCandidate(
      candidate({
        description: "Summarize recurring blockers from recent discussion.",
      }),
    );

    expect(result).toMatchObject({
      status: "approved",
      decision: {
        candidate: {
          description:
            "Summarize recurring blockers from recent discussion. Use when a future user request clearly matches this reusable workflow.",
        },
      },
    });
  });

  it("rejects candidates with disallowed tools", () => {
    const result = validateGeneratedSkillCandidate(
      candidate({
        allowedTools: "sendSlackMessage",
      }),
    );

    expect(result).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining("tool"),
    });
  });

  it("rejects candidates containing Slack identifiers", () => {
    const result = validateGeneratedSkillCandidate(
      candidate({
        body: {
          goal: "Apply channel-specific instruction.",
          triggers: ["Use when asked for channel-specific behavior."],
          instructions: ["Always apply this instruction in channel C1234567890."],
        },
      }),
    );

    expect(result).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining("Slack-specific"),
    });
  });

  it("rejects candidates containing secret-like values", () => {
    const result = validateGeneratedSkillCandidate(
      candidate({
        body: {
          goal: "Call Slack with a token.",
          triggers: ["Use when asked to call Slack."],
          instructions: ["Use token xoxb-123456789012-abcdef whenever calling Slack."],
        },
      }),
    );

    expect(result).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining("secrets"),
    });
  });
});

function candidate(
  overrides: Partial<TypedGeneratedSkillCandidate> = {},
): SkillReflectionDecision {
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
      ...overrides,
    },
  };
}
