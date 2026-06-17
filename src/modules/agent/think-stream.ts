export function extractTextDeltaFromThinkStreamChunk(json: string): string | null {
  let chunk: unknown;

  try {
    chunk = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isRecord(chunk)) {
    return null;
  }

  if (chunk.type !== "text-delta") {
    return null;
  }

  return typeof chunk.delta === "string" && chunk.delta.length > 0 ? chunk.delta : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
