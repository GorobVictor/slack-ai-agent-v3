import { App, LogLevel } from "@slack/bolt";

import type { LoggerPort } from "../../ports/logger.port.js";
import type {
  SendSlackMessageInput,
  SendSlackMessageResult,
  SlackMessengerPort,
} from "../../ports/slack-messenger.port.js";
import type { SlackSocketPort } from "../../ports/slack-socket.port.js";
import { AppError } from "../../shared/errors.js";
import type { SlackRawEventEnvelope } from "../../modules/slack-listener/slack-listener.types.js";

type SlackBodyMetadata = {
  event_id?: unknown;
  event_time?: unknown;
  team_id?: unknown;
};

export type SlackSocketModeAdapterOptions = {
  botToken: string;
  appToken: string;
  logLevel?: LogLevel;
  logger: LoggerPort;
};

export class SlackSocketModeAdapter implements SlackSocketPort, SlackMessengerPort {
  private readonly app: App;
  private readonly handlers: Array<(event: unknown) => Promise<void>> = [];

  constructor(private readonly options: SlackSocketModeAdapterOptions) {
    this.app = new App({
      token: options.botToken,
      appToken: options.appToken,
      socketMode: true,
      logLevel: options.logLevel,
    });

    this.registerSlackEventHandlers();
    this.registerErrorHandler();
  }

  onMessage(handler: (event: unknown) => Promise<void>): void {
    this.handlers.push(handler);
  }

  async start(): Promise<void> {
    await this.app.start();
  }

  async resolveBotUserId(): Promise<string> {
    const response = await this.app.client.auth.test();

    if (!response.user_id) {
      throw new AppError("SLACK_BOT_USER_ID_UNRESOLVED", "Could not resolve Slack bot user id");
    }

    return response.user_id;
  }

  async sendMessage(input: SendSlackMessageInput): Promise<SendSlackMessageResult> {
    const response = await this.app.client.chat.postMessage({
      channel: input.channelId,
      text: input.text,
      thread_ts: input.threadTs,
    });

    if (!response.ts) {
      throw new AppError("SLACK_MESSAGE_TS_MISSING", "Slack did not return a message timestamp");
    }

    return {
      messageTs: response.ts,
    };
  }

  private registerSlackEventHandlers(): void {
    this.app.event("app_mention", async ({ event, body }) => {
      await this.dispatch({ event, body });
    });

    this.app.event("message", async ({ event, body }) => {
      await this.dispatch({ event, body });
    });
  }

  private registerErrorHandler(): void {
    this.app.error(async (error) => {
      this.options.logger.error("Slack Socket Mode error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    });
  }

  private async dispatch(envelope: SlackRawEventEnvelope): Promise<void> {
    const safeEnvelope = buildSafeSlackRawEventEnvelope(envelope);

    for (const handler of this.handlers) {
      await handler(safeEnvelope);
    }
  }
}

export function buildSafeSlackRawEventEnvelope(
  envelope: SlackRawEventEnvelope,
): SlackRawEventEnvelope {
  return {
    event: envelope.event,
    body: buildSafeSlackBodyMetadata(envelope.body),
  };
}

function buildSafeSlackBodyMetadata(body: unknown): SlackBodyMetadata | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const safeBody: SlackBodyMetadata = {};
  copyIfPresent(safeBody, body, "event_id");
  copyIfPresent(safeBody, body, "event_time");
  copyIfPresent(safeBody, body, "team_id");

  return Object.keys(safeBody).length ? safeBody : undefined;
}

function copyIfPresent(
  target: SlackBodyMetadata,
  source: Record<string, unknown>,
  key: keyof SlackBodyMetadata,
): void {
  if (source[key] !== undefined) {
    target[key] = source[key];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toSlackLogLevel(logLevel: string): LogLevel {
  switch (logLevel) {
    case "debug":
      return LogLevel.DEBUG;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    case "info":
    default:
      return LogLevel.INFO;
  }
}
