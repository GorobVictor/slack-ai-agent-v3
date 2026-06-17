import { describe, expect, it } from "vitest";

import {
  parseWorkerReplyResponse,
  parseWorkerStreamLine,
} from "./worker-event-client.adapter.js";

describe("parseWorkerReplyResponse", () => {
  it("parses reply responses", () => {
    expect(
      parseWorkerReplyResponse({
        status: "reply",
        text: "hello",
        threadTs: "1710000000.000100",
      }),
    ).toEqual({
      status: "reply",
      text: "hello",
      threadTs: "1710000000.000100",
    });
  });

  it("parses no_reply responses", () => {
    expect(parseWorkerReplyResponse({ status: "no_reply" })).toEqual({
      status: "no_reply",
    });
  });

  it("rejects malformed responses", () => {
    expect(() => parseWorkerReplyResponse({ status: "reply", text: "" })).toThrow(
      "Worker returned an invalid reply response",
    );
  });
});

describe("parseWorkerStreamLine", () => {
  it("parses Worker stream events", () => {
    expect(parseWorkerStreamLine(JSON.stringify({ type: "delta", text: "hello" }))).toEqual({
      type: "delta",
      text: "hello",
    });
  });

  it("rejects malformed stream events", () => {
    expect(() => parseWorkerStreamLine("{")).toThrow("Worker returned malformed stream JSON");
    expect(() => parseWorkerStreamLine(JSON.stringify({ type: "delta", text: "" }))).toThrow(
      "Worker returned an invalid stream event",
    );
  });
});
