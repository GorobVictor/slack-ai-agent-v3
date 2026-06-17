import { describe, expect, it } from "vitest";

import { CloudflareSkillReflectionQueueAdapter } from "./cloudflare-skill-reflection-queue.adapter.js";
import type { SkillReflectionJob } from "../../modules/agent/skill-reflection-job.js";
import type { SlackWorkerRequest } from "../../modules/slack/slack.types.js";

describe("CloudflareSkillReflectionQueueAdapter", () => {
  it("sends versioned skill reflection jobs to Cloudflare Queues", async () => {
    const sent: Array<{ body: SkillReflectionJob; options?: QueueSendOptions }> = [];
    const queue: Queue<SkillReflectionJob> = {
      async send(body, options) {
        sent.push({ body, options });
        return queueSendResult();
      },
      async sendBatch() {
        return queueSendResult();
      },
      async metrics() {
        return {
          backlogCount: 1,
          backlogBytes: 128,
          oldestMessageTimestamp: new Date(),
        };
      },
    };
    const adapter = new CloudflareSkillReflectionQueueAdapter(queue);

    await adapter.enqueue({
      event: event(),
      assistantReply: "Use the deployment checklist.",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toMatchObject({
      version: 1,
      idempotencyKey: "Ev123",
      assistantReply: "Use the deployment checklist.",
    });
    expect(sent[0]?.options).toEqual({
      contentType: "json",
    });
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

function queueSendResult(): Awaited<ReturnType<Queue<SkillReflectionJob>["send"]>> {
  return {
    metadata: {
      metrics: {
        backlogCount: 1,
        backlogBytes: 128,
        oldestMessageTimestamp: new Date(),
      },
    },
  };
}
