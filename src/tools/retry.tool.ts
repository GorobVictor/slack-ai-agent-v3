export type RetryOptions = {
  attempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 2_000;
  const factor = options.factor ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= attempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      await sleep(Math.min(initialDelayMs * factor ** (attempt - 1), maxDelayMs));
    }
  }

  throw lastError;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
