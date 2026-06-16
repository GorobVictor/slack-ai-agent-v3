import { describe, expect, it } from "vitest";

import { InMemoryGeneratedSkillAdapter } from "../../adapters/storage/in-memory-generated-skill.adapter.js";
import type { GeneratedSkill } from "../../ports/generated-skill.port.js";
import { createGeneratedSkillSource, GENERATED_SKILL_SOURCE_ID } from "./generated-skill-source.js";

describe("createGeneratedSkillSource", () => {
  it("lists and loads enabled skills only", async () => {
    const source = createGeneratedSkillSource(
      new InMemoryGeneratedSkillAdapter([
        generatedSkill({ name: "enabled-skill" }),
        generatedSkill({ name: "disabled-skill", disabled: true }),
      ]),
    );

    await expect(source.list()).resolves.toEqual([
      expect.objectContaining({
        name: "enabled-skill",
        sourceId: GENERATED_SKILL_SOURCE_ID,
      }),
    ]);
    await expect(source.load("enabled-skill")).resolves.toMatchObject({
      name: "enabled-skill",
      body: "Use this reusable workflow.",
    });
    await expect(source.load("disabled-skill")).resolves.toBeNull();
  });
});

function generatedSkill(overrides: Partial<GeneratedSkill> = {}): GeneratedSkill {
  return {
    id: crypto.randomUUID(),
    name: "enabled-skill",
    description: "Use this generated skill. Use when users ask for this reusable workflow.",
    body: "Use this reusable workflow.",
    allowedTools: "getSlackHistoryContext",
    version: 1,
    disabled: false,
    confidence: 0.95,
    autoApprovalReason: "Reusable workflow.",
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    ...overrides,
  };
}
