import { describe, expect, it } from "vitest";

import { renderGeneratedSkillBody } from "./generated-skill-body.js";

describe("renderGeneratedSkillBody", () => {
  it("renders typed generated skill body into canonical markdown", () => {
    expect(
      renderGeneratedSkillBody({
        goal: "Return concise Slack history.",
        triggers: ["Use when users ask for thread history."],
        instructions: ["Read captured Slack history.", "List who wrote what and when."],
        safetyNotes: ["Do not invent missing messages."],
        toolUsage: [
          {
            tool: "getSlackHistoryContext",
            when: "the user asks for Slack conversation history.",
          },
        ],
      }),
    ).toBe(
      [
        "## Goal",
        "",
        "Return concise Slack history.",
        "",
        "## Triggers",
        "",
        "- Use when users ask for thread history.",
        "",
        "## Instructions",
        "",
        "- Read captured Slack history.",
        "- List who wrote what and when.",
        "",
        "## Safety Notes",
        "",
        "- Do not invent missing messages.",
        "",
        "## Tool Usage",
        "",
        "- Call `getSlackHistoryContext` when the user asks for Slack conversation history.",
      ].join("\n"),
    );
  });
});
