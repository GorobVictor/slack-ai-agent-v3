import type { WorkerEventClientPort } from "../../ports/worker-event-client.port.js";
import { AppError } from "../../shared/errors.js";
import { retry } from "../../tools/retry.tool.js";
import type { NormalizedSlackMessageEvent } from "../../modules/slack-listener/slack-listener.types.js";

export type WorkerEventClientAdapterOptions = {
  endpointUrl: string;
  internalApiToken: string;
};

export class WorkerEventClientAdapter implements WorkerEventClientPort {
  constructor(private readonly options: WorkerEventClientAdapterOptions) {}

  async sendSlackMessageEvent(event: NormalizedSlackMessageEvent): Promise<void> {
    await retry(
      async () => {
        const response = await fetch(this.options.endpointUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.internalApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          throw new AppError("WORKER_EVENT_SEND_FAILED", "Worker rejected Slack event", {
            status: response.status,
            statusText: response.statusText,
          });
        }
      },
      {
        attempts: 3,
        initialDelayMs: 250,
        maxDelayMs: 1_000,
        shouldRetry: (error) => shouldRetryWorkerError(error),
      },
    );
  }
}

function shouldRetryWorkerError(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return true;
  }

  const status = error.metadata?.status;

  if (typeof status !== "number") {
    return false;
  }

  return status === 429 || status >= 500;
}
