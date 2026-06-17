import type { WorkerEventClientPort } from "../../ports/worker-event-client.port.js";
import { AppError } from "../../shared/errors.js";
import { retry } from "../../tools/retry.tool.js";
import type {
  SlackWorkerRequest,
  WorkerSlackStreamEvent,
  WorkerSlackReplyResponse,
} from "../../modules/slack/slack.types.js";
import {
  parseWorkerSlackReplyResponse,
  parseWorkerSlackStreamEvent,
} from "../../modules/slack/slack.validation.js";
import type { WorkerSlackMessageStreamCallbacks } from "../../ports/worker-event-client.port.js";

export type WorkerEventClientAdapterOptions = {
  endpointUrl: string;
  internalApiToken: string;
};

export class WorkerEventClientAdapter implements WorkerEventClientPort {
  constructor(private readonly options: WorkerEventClientAdapterOptions) {}

  async sendSlackMessageEvent(
    event: SlackWorkerRequest,
  ): Promise<WorkerSlackReplyResponse> {
    return retry(
      async () => {
        const response = await fetch(this.options.endpointUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.internalApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          throw new AppError("WORKER_EVENT_SEND_FAILED", "Worker rejected Slack event", {
            status: response.status,
            statusText: response.statusText,
          });
        }

        return parseWorkerReplyResponse(await response.json());
      },
      {
        attempts: 3,
        initialDelayMs: 250,
        maxDelayMs: 1_000,
        shouldRetry: (error) => shouldRetryWorkerError(error),
      },
    );
  }

  async streamSlackMessageEvent(
    event: SlackWorkerRequest,
    callbacks: WorkerSlackMessageStreamCallbacks,
  ): Promise<WorkerSlackReplyResponse> {
    let sawStreamDelta = false;

    return retry(
      async () => {
        const response = await fetch(this.options.endpointUrl, {
          method: "POST",
          headers: {
            Accept: "application/x-ndjson",
            Authorization: `Bearer ${this.options.internalApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          throw new AppError("WORKER_EVENT_SEND_FAILED", "Worker rejected Slack event", {
            status: response.status,
            statusText: response.statusText,
          });
        }

        if (!isNdjsonResponse(response)) {
          return parseWorkerReplyResponse(await response.json());
        }

        return readWorkerSlackStream(response, {
          async onDelta(input) {
            sawStreamDelta = true;
            await callbacks.onDelta(input);
          },
        });
      },
      {
        attempts: 3,
        initialDelayMs: 250,
        maxDelayMs: 1_000,
        shouldRetry: (error) => !sawStreamDelta && shouldRetryWorkerError(error),
      },
    );
  }
}

export function parseWorkerReplyResponse(value: unknown): WorkerSlackReplyResponse {
  const parsed = parseWorkerSlackReplyResponse(value);

  if (!parsed) {
    throw new AppError("WORKER_REPLY_INVALID", "Worker returned an invalid reply response");
  }

  return parsed;
}

function shouldRetryWorkerError(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return true;
  }

  const status = error.metadata?.status;

  if (typeof status !== "number") {
    return false;
  }

  return status === 429 || status >= 500;
}

async function readWorkerSlackStream(
  response: Response,
  callbacks: WorkerSlackMessageStreamCallbacks,
): Promise<WorkerSlackReplyResponse> {
  if (!response.body) {
    throw new AppError("WORKER_STREAM_BODY_MISSING", "Worker stream response is missing a body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const response = await handleWorkerSlackStreamLine(line, callbacks);

      if (response) {
        return response;
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const response = await handleWorkerSlackStreamLine(buffer, callbacks);

    if (response) {
      return response;
    }
  }

  throw new AppError("WORKER_STREAM_INCOMPLETE", "Worker stream ended without a terminal event");
}

async function handleWorkerSlackStreamLine(
  line: string,
  callbacks: WorkerSlackMessageStreamCallbacks,
): Promise<WorkerSlackReplyResponse | null> {
  if (!line.trim()) {
    return null;
  }

  const event = parseWorkerStreamLine(line);

  switch (event.type) {
    case "delta":
      await callbacks.onDelta({
        text: event.text,
      });
      return null;
    case "done":
      return {
        status: "reply",
        text: event.text,
        threadTs: event.threadTs,
      };
    case "no_reply":
      return {
        status: "no_reply",
        reason: event.reason,
      };
    case "error":
      return {
        status: "error",
        code: event.code,
        message: event.message,
      };
  }
}

export function parseWorkerStreamLine(line: string): WorkerSlackStreamEvent {
  let parsed: unknown;

  try {
    parsed = JSON.parse(line);
  } catch {
    throw new AppError("WORKER_STREAM_EVENT_INVALID", "Worker returned malformed stream JSON");
  }

  const event = parseWorkerSlackStreamEvent(parsed);

  if (!event) {
    throw new AppError("WORKER_STREAM_EVENT_INVALID", "Worker returned an invalid stream event");
  }

  return event;
}

function isNdjsonResponse(response: Response): boolean {
  return response.headers.get("Content-Type")?.includes("application/x-ndjson") ?? false;
}
