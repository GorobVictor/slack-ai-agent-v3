import { describe, expect, it } from "vitest";

import { parseWorkerReplyResponse } from "./worker-event-client.adapter.js";

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
