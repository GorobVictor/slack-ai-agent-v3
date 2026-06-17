import {
  createSkillReflectionJob,
  type SkillReflectionJob,
} from "../../modules/agent/skill-reflection-job.js";
import type {
  EnqueueSkillReflectionInput,
  SkillReflectionQueuePort,
} from "../../ports/skill-reflection-queue.port.js";

export class CloudflareSkillReflectionQueueAdapter implements SkillReflectionQueuePort {
  constructor(private readonly queue: Queue<SkillReflectionJob>) {}

  async enqueue(input: EnqueueSkillReflectionInput): Promise<void> {
    await this.queue.send(createSkillReflectionJob(input), {
      contentType: "json",
    });
  }
}
