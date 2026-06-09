export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerPort {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}
