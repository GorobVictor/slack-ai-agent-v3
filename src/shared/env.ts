import { AppError } from "./errors.js";
import type { LogLevel } from "../ports/logger.port.js";

export type ListenerEnv = {
  slackBotToken: string;
  slackAppToken: string;
  slackBotUserId?: string;
  workerSlackEventUrl: string;
  workerInternalApiToken: string;
  logLevel: LogLevel;
};

const LOG_LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);

export function loadListenerEnv(source: NodeJS.ProcessEnv = process.env): ListenerEnv {
  const slackBotToken = readRequiredEnv(source, "SLACK_BOT_TOKEN");
  const slackAppToken = readRequiredEnv(source, "SLACK_APP_TOKEN");
  const workerSlackEventUrl = readRequiredEnv(source, "WORKER_SLACK_EVENT_URL");
  const workerInternalApiToken = readRequiredEnv(source, "WORKER_INTERNAL_API_TOKEN");
  const logLevel = readLogLevel(source.LOG_LEVEL);
  const slackBotUserId = readOptionalEnv(source, "SLACK_BOT_USER_ID");

  validateWorkerSlackEventUrl(workerSlackEventUrl);

  return {
    slackBotToken,
    slackAppToken,
    slackBotUserId,
    workerSlackEventUrl,
    workerInternalApiToken,
    logLevel,
  };
}

function readRequiredEnv(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key]?.trim();

  if (!value) {
    throw new AppError("ENV_MISSING", `Missing required environment variable: ${key}`, {
      key,
    });
  }

  return value;
}

function readOptionalEnv(source: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = source[key]?.trim();
  return value ? value : undefined;
}

function readLogLevel(value: string | undefined): LogLevel {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "info";
  }

  if (!LOG_LEVELS.has(normalized as LogLevel)) {
    throw new AppError("ENV_INVALID", "LOG_LEVEL must be one of debug, info, warn, or error", {
      key: "LOG_LEVEL",
    });
  }

  return normalized as LogLevel;
}

function validateUrl(value: string, key: string): void {
  try {
    new URL(value);
  } catch {
    throw new AppError("ENV_INVALID", `${key} must be a valid URL`, { key });
  }
}

function validateWorkerSlackEventUrl(value: string): void {
  validateUrl(value, "WORKER_SLACK_EVENT_URL");

  const url = new URL(value);

  if (url.pathname !== "/slack/events") {
    throw new AppError("ENV_INVALID", "WORKER_SLACK_EVENT_URL must target /slack/events", {
      key: "WORKER_SLACK_EVENT_URL",
      pathname: url.pathname,
    });
  }
}
