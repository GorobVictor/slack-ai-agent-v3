import { describe, expect, it } from "vitest";

import { extractTextDeltaFromThinkStreamChunk } from "./think-stream.js";

describe("extractTextDeltaFromThinkStreamChunk", () => {
  it("extracts text deltas from Think stream chunks", () => {
    expect(
      extractTextDeltaFromThinkStreamChunk(
        JSON.stringify({
          type: "text-delta",
          delta: "hello",
        }),
      ),
    ).toBe("hello");
  });

  it("ignores non-text chunks and malformed JSON", () => {
    expect(
      extractTextDeltaFromThinkStreamChunk(
        JSON.stringify({
          type: "reasoning-delta",
          delta: "hidden reasoning",
        }),
      ),
    ).toBeNull();
    expect(extractTextDeltaFromThinkStreamChunk("not-json")).toBeNull();
  });
});
