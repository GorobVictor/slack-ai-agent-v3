import type { SkillManifest } from "agents/skills";

export const SLACK_AGENT_SKILL_SOURCE_ID = "slack-agent-local-skills";
export const SUM_CHANNEL_TODAY_SKILL_NAME = "sum-channel-today";

export const slackAgentSkillManifest = {
  id: SLACK_AGENT_SKILL_SOURCE_ID,
  fingerprint: "v1",
  skills: [
    {
      name: SUM_CHANNEL_TODAY_SKILL_NAME,
      description:
        "Summarize today's captured Slack discussion in the current channel, including thread replies.",
      allowedTools: "getSlackHistoryContext",
      body: [
        "Use this skill when a Slack user asks for a summary of today's discussion in the current channel.",
        "",
        "Steps:",
        "1. Call `getSlackHistoryContext` with `scope: \"channel_with_threads\"` and `days: 1`.",
        "2. Read the returned captured Slack history and identify the main topics, decisions, blockers, and follow-up items.",
        "3. Reply concisely in Slack. Prefer short sections with bullets when there are multiple topics.",
        "4. If no captured history is available, say that there is no captured Slack history for today instead of inventing details.",
      ].join("\n"),
    },
  ],
} satisfies SkillManifest;
