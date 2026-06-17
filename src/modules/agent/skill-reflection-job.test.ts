import { describe, expect, it } from "vitest";

import {
  createSkillReflectionJob,
  parseSkillReflectionJob,
  SKILL_REFLECTION_JOB_VERSION,
} from "./skill-reflection-job.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";

describe("skill reflection jobs", () => {
  it("creates and parses versioned queue jobs", () => {
    const job = createSkillReflectionJob({
      event: event(),
      assistantReply: "Use the deployment checklist.",
    });

    expect(job).toMatchObject({
      version: SKILL_REFLECTION_JOB_VERSION,
      idempotencyKey: "Ev123",
      assistantReply: "Use the deployment checklist.",
    });
    expect(parseSkillReflectionJob(job)).toEqual(job);
  });

  it("rejects invalid queue message bodies", () => {
    expect(parseSkillReflectionJob({ version: 1 })).toBeNull();
    expect(
      parseSkillReflectionJob({
        ...createSkillReflectionJob({
          event: event(),
          assistantReply: "Use the deployment checklist.",
        }),
        assistantReply: "",
      }),
    ).toBeNull();
  });

  it("rejects jobs whose idempotency key does not match the Slack event", () => {
    expect(
      parseSkillReflectionJob({
        ...createSkillReflectionJob({
          event: event(),
          assistantReply: "Use the deployment checklist.",
        }),
        idempotencyKey: "different",
      }),
    ).toBeNull();
  });
});

function event(overrides: Partial<SlackWorkerRequest> = {}): SlackWorkerRequest {
  return {
    source: "slack",
    teamId: "T123",
    channelId: "C123",
    userId: "U123",
    text: "hello",
    messageTs: "1710000000.000200",
    channelType: "channel",
    isMention: false,
    isThreadMessage: false,
    idempotencyKey: "Ev123",
    processingIntent: "invoke",
    ...overrides,
  };
}
