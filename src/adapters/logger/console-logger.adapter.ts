import type { LoggerPort, LogLevel } from "../../ports/logger.port.js";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MAX_METADATA_VALUE_LENGTH = 160;

export class ConsoleLoggerAdapter implements LoggerPort {
  constructor(private readonly level: LogLevel = "info") {}

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write("error", message, metadata);
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.level]) {
      return;
    }

    const line = formatLogLine(level, message, metadata);

    if (level === "error") {
      console.error(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.info(line);
  }
}

function formatLogLine(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
): string {
  const prefix = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
  const metadataText = formatMetadata(metadata);

  return metadataText ? `${prefix} ${metadataText}` : prefix;
}

function formatMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata) {
    return "";
  }

  return Object.entries(metadata)
    .flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      return `{${key}}=[${formatMetadataValue(value)}]`;
    })
    .join(" ");
}

function formatMetadataValue(value: unknown): string {
  if (value instanceof Error) {
    return quoteIfNeeded(truncate(value.message));
  }

  if (typeof value === "string") {
    return quoteIfNeeded(truncate(value));
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return quoteIfNeeded(truncate(safeStringify(value)));
}

function quoteIfNeeded(value: string): string {
  if (value === "" || /\s|=/.test(value)) {
    return JSON.stringify(value);
  }

  return value;
}

function truncate(value: string): string {
  if (value.length <= MAX_METADATA_VALUE_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_METADATA_VALUE_LENGTH - 3)}...`;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (nestedValue instanceof Error) {
        return {
          name: nestedValue.name,
          message: nestedValue.message,
        };
      }

      if (typeof nestedValue === "object" && nestedValue !== null) {
        if (seen.has(nestedValue)) {
          return "[Circular]";
        }

        seen.add(nestedValue);
      }

      return nestedValue;
    });
  } catch {
    return String(value);
  }
}
