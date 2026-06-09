import { describe, expect, it } from "vitest";

import {
  SLACK_AGENT_SKILL_SOURCE_ID,
  SUM_CHANNEL_TODAY_SKILL_NAME,
  slackAgentSkillManifest,
} from "./agent.skills.manifest.js";

describe("slackAgentSkillManifest", () => {
  it("registers the sum-channel-today skill", async () => {
    const skill = slackAgentSkillManifest.skills.find(
      (candidate) => candidate.name === SUM_CHANNEL_TODAY_SKILL_NAME,
    );

    expect(slackAgentSkillManifest.id).toBe(SLACK_AGENT_SKILL_SOURCE_ID);
    expect(skill).toMatchObject({
      name: SUM_CHANNEL_TODAY_SKILL_NAME,
      allowedTools: "getSlackHistoryContext",
    });
    expect(skill?.description).toContain("today's captured Slack discussion");
  });

  it("loads instructions for summarizing today's channel history", async () => {
    const skill = slackAgentSkillManifest.skills.find(
      (candidate) => candidate.name === SUM_CHANNEL_TODAY_SKILL_NAME,
    );

    expect(skill?.body).toContain('scope: "channel_with_threads"');
    expect(skill?.body).toContain("days: 1");
    expect(skill?.body).toContain("no captured Slack history");
  });
});
