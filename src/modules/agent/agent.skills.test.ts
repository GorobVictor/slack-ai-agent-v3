import { describe, expect, it } from "vitest";

import { InMemoryGeneratedSkillAdapter } from "../../adapters/storage/in-memory-generated-skill.adapter.js";
import { createSlackAgentSkillSources } from "./agent.skills.js";
import { GENERATED_SKILL_SOURCE_ID } from "./generated-skill-source.js";

describe("createSlackAgentSkillSources", () => {
  it("uses only the D1-backed generated skill source", async () => {
    const repository = new InMemoryGeneratedSkillAdapter([
      {
        id: "skill-1",
        name: "summarize-recurring-blockers",
        description:
          "Summarize recurring blockers from recent discussion. Use when users ask about repeated blockers or unresolved follow-ups.",
        body: "Look for repeated blockers, decisions, owners, and follow-up items before replying.",
        allowedTools: "getSlackHistoryContext",
        version: 1,
        disabled: false,
        confidence: 0.95,
        autoApprovalReason: "Reusable workflow for blocker summaries.",
        createdAt: 1710000000000,
        updatedAt: 1710000000000,
      },
    ]);

    const sources = createSlackAgentSkillSources(repository);

    expect(sources).toHaveLength(1);
    expect(sources[0]?.id).toBe(GENERATED_SKILL_SOURCE_ID);

    await expect(sources[0]?.list()).resolves.toEqual([
      expect.objectContaining({
        name: "summarize-recurring-blockers",
        allowedTools: "getSlackHistoryContext",
      }),
    ]);
  });
});
