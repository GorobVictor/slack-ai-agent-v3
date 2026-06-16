import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsoleLoggerAdapter } from "./console-logger.adapter.js";

describe("ConsoleLoggerAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes readable info logs with key-value metadata", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleLoggerAdapter("info");

    logger.info("Forwarded Slack event to Worker", {
      teamId: "T123",
      channelId: "C123",
      processingIntent: "invoke",
      workerReplyStatus: "no reply",
      skipped: undefined,
    });

    expect(info).toHaveBeenCalledOnce();
    const line = String(info.mock.calls[0]?.[0]);

    expect(line).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z INFO Forwarded Slack event to Worker /,
    );
    expect(line).not.toMatch(/^\{/);
    expect(line).toContain("teamId=T123");
    expect(line).toContain("channelId=C123");
    expect(line).toContain("processingIntent=invoke");
    expect(line).toContain('workerReplyStatus="no reply"');
    expect(line).not.toContain("skipped=");
  });

  it("routes warnings and errors to the matching console methods", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = new ConsoleLoggerAdapter("info");

    logger.info("Info message");
    logger.warn("Warn message");
    logger.error("Error message");

    expect(info).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain("WARN Warn message");
    expect(String(error.mock.calls[0]?.[0])).toContain("ERROR Error message");
  });

  it("truncates large metadata values", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleLoggerAdapter("info");
    const longValue = "x".repeat(220);

    logger.info("Large payload avoided", {
      body: {
        event_id: "Ev123",
        nested: longValue,
      },
    });

    expect(info).toHaveBeenCalledOnce();
    const line = String(info.mock.calls[0]?.[0]);

    expect(line).toContain("body=");
    expect(line).toContain("...");
    expect(line).not.toContain(longValue);
    expect(line.length).toBeLessThan(260);
  });

  it("filters logs below the configured level", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new ConsoleLoggerAdapter("warn");

    logger.info("Ignored info message");

    expect(info).not.toHaveBeenCalled();
  });
});
