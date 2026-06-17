import { z } from "zod";

import { normalizedSlackMessageEventSchema } from "../slack/slack.validation.js";
import type { SlackWorkerRequest } from "../slack/slack.types.js";

export const SKILL_REFLECTION_JOB_VERSION = 1;

const skillReflectionJobSchema = z
  .object({
    version: z.literal(SKILL_REFLECTION_JOB_VERSION),
    idempotencyKey: z.string().min(1),
    event: normalizedSlackMessageEventSchema,
    assistantReply: z.string().min(1),
    createdAt: z.number().int().nonnegative(),
  })
  .superRefine((value, context) => {
    if (value.idempotencyKey !== value.event.idempotencyKey) {
      context.addIssue({
        code: "custom",
        path: ["idempotencyKey"],
        message: "Skill reflection job idempotencyKey must match event.idempotencyKey.",
      });
    }
  });

export type SkillReflectionJob = z.infer<typeof skillReflectionJobSchema>;

export type CreateSkillReflectionJobInput = {
  event: SlackWorkerRequest;
  assistantReply: string;
};

export function createSkillReflectionJob(
  input: CreateSkillReflectionJobInput,
): SkillReflectionJob {
  return {
    version: SKILL_REFLECTION_JOB_VERSION,
    idempotencyKey: input.event.idempotencyKey,
    event: input.event,
    assistantReply: input.assistantReply,
    createdAt: Date.now(),
  };
}

export function parseSkillReflectionJob(value: unknown): SkillReflectionJob | null {
  const result = skillReflectionJobSchema.safeParse(value);
  return result.success ? result.data : null;
}
