import { z } from "zod";

import type {
  SlackWorkerRequest,
  WorkerSlackStreamEvent,
  WorkerSlackReplyResponse,
} from "./slack.types.js";

export const normalizedSlackMessageEventSchema = z.object({
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
  processingIntent: z.enum(["capture", "invoke"]),
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

const workerSlackStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("delta"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("done"),
    text: z.string(),
    threadTs: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("no_reply"),
    reason: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("error"),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export function parseNormalizedSlackMessageEvent(
  value: unknown,
): SlackWorkerRequest | null {
  const result = normalizedSlackMessageEventSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseWorkerSlackReplyResponse(value: unknown): WorkerSlackReplyResponse | null {
  const result = workerSlackReplyResponseSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseWorkerSlackStreamEvent(value: unknown): WorkerSlackStreamEvent | null {
  const result = workerSlackStreamEventSchema.safeParse(value);
  return result.success ? result.data : null;
}
