import { z } from "zod";

import type {
  NormalizedSlackMessageEvent,
  WorkerSlackReplyResponse,
} from "./slack.types.js";

const normalizedSlackMessageEventSchema = z.object({
  source: z.literal("slack"),
  teamId: z.string().min(1),
  channelId: z.string().min(1),
  userId: z.string().min(1),
  text: z.string(),
  messageTs: z.string().min(1),
  threadTs: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  eventTs: z.string().min(1).optional(),
  clientMsgId: z.string().min(1).optional(),
  channelType: z.string().min(1).optional(),
  isMention: z.boolean(),
  isThreadMessage: z.boolean(),
  idempotencyKey: z.string().min(1),
});

const workerSlackReplyResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("reply"),
    text: z.string().min(1),
    threadTs: z.string().min(1).optional(),
  }),
  z.object({
    status: z.literal("no_reply"),
    reason: z.string().min(1).optional(),
  }),
  z.object({
    status: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export function parseNormalizedSlackMessageEvent(
  value: unknown,
): NormalizedSlackMessageEvent | null {
  const result = normalizedSlackMessageEventSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseWorkerSlackReplyResponse(value: unknown): WorkerSlackReplyResponse | null {
  const result = workerSlackReplyResponseSchema.safeParse(value);
  return result.success ? result.data : null;
}
