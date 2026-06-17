import type { LoggerPort } from "../../ports/logger.port.js";
import { timingSafeEqual } from "../../tools/crypto.tool.js";
import { parseNormalizedSlackMessageEvent } from "./slack.validation.js";
import type { HandleSlackMessageUseCase } from "./handle-slack-message.use-case.js";
import type { WorkerSlackReplyResponse, WorkerSlackStreamEvent } from "./slack.types.js";

export type SlackHandlerOptions = {
  internalApiToken: string;
  useCase: HandleSlackMessageUseCase;
  logger: LoggerPort;
};

export async function handleSlackEventRequest(
  request: Request,
  options: SlackHandlerOptions,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        status: "error",
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed",
      },
      405,
    );
  }

  if (!(await isAuthorized(request, options.internalApiToken))) {
    return jsonResponse(
      {
        status: "error",
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      },
      401,
    );
  }

  const body = await readJsonBody(request);
  const event = parseNormalizedSlackMessageEvent(body);

  if (!event) {
    return jsonResponse(
      {
        status: "error",
        code: "SLACK_EVENT_INVALID",
        message: "Slack event payload is invalid",
      },
      400,
    );
  }

  try {
    if (acceptsStream(request)) {
      return streamResponse(event, options);
    }

    const response = await options.useCase.execute(event);
    return jsonResponse(response);
  } catch (error) {
    options.logger.error("Failed to handle Slack event in Worker", {
      teamId: event.teamId,
      channelId: event.channelId,
      threadTs: event.threadTs,
      messageTs: event.messageTs,
      eventId: event.eventId,
      channelType: event.channelType,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return jsonResponse(
      {
        status: "error",
        code: "SLACK_EVENT_PROCESSING_FAILED",
        message: "Failed to process Slack event",
      },
      500,
    );
  }
}

function streamResponse(event: Parameters<HandleSlackMessageUseCase["execute"]>[0], options: SlackHandlerOptions): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (streamEvent: WorkerSlackStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(streamEvent)}\n`));
      };

      try {
        const response = await options.useCase.executeStream(event, {
          onTextDelta(text) {
            write({
              type: "delta",
              text,
            });
          },
        });

        write(toStreamTerminalEvent(response));
      } catch (error) {
        options.logger.error("Failed to stream Slack event in Worker", {
          teamId: event.teamId,
          channelId: event.channelId,
          threadTs: event.threadTs,
          messageTs: event.messageTs,
          eventId: event.eventId,
          channelType: event.channelType,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        write({
          type: "error",
          code: "SLACK_EVENT_PROCESSING_FAILED",
          message: "Failed to process Slack event",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}

function acceptsStream(request: Request): boolean {
  return request.headers.get("Accept")?.includes("application/x-ndjson") ?? false;
}

function toStreamTerminalEvent(response: WorkerSlackReplyResponse): WorkerSlackStreamEvent {
  if (response.status === "reply") {
    return {
      type: "done",
      text: response.text,
      threadTs: response.threadTs,
    };
  }

  if (response.status === "no_reply") {
    return {
      type: "no_reply",
      reason: response.reason,
    };
  }

  return {
    type: "error",
    code: response.code,
    message: response.message,
  };
}

async function isAuthorized(request: Request, internalApiToken: string): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  const expected = `Bearer ${internalApiToken}`;

  if (!authorization) {
    return false;
  }

  return timingSafeEqual(authorization, expected);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function jsonResponse(body: WorkerSlackReplyResponse, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
