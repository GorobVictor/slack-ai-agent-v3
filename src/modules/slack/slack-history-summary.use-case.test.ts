import { describe, expect, it } from "vitest";

import { InMemorySlackMessageHistoryAdapter } from "../../adapters/storage/in-memory-slack-message-history.adapter.js";
import type { SlackWorkerRequest } from "./slack.types.js";
import { BuildSlackHistoryContextUseCase } from "./slack-history-summary.use-case.js";

describe("BuildSlackHistoryContextUseCase", () => {
  it("formats thread history for the current thread", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    await history.saveMessage(event({ messageTs: "1710000000.000100", threadTs: "1710000000.000100", text: "first" }));
    await history.saveMessage(event({ messageTs: "1710000010.000100", threadTs: "1710000000.000100", text: "second" }));
    await history.saveMessage(event({ idempotencyKey: "Ev999", messageTs: "1710000020.000100", text: "channel root" }));

    const useCase = new BuildSlackHistoryContextUseCase(history);

    await expect(
      useCase.execute({
        currentEvent: event({ messageTs: "1710000100.000100", threadTs: "1710000000.000100" }),
        scope: "thread",
        days: 1,
      }),
    ).resolves.toContain("second");
  });

  it("combines channel root messages and thread replies for channel_with_threads", async () => {
    const history = new InMemorySlackMessageHistoryAdapter();
    await history.saveMessage(event({ messageTs: "1710000000.000100", text: "channel root" }));
    await history.saveMessage(event({ messageTs: "1710000010.000100", threadTs: "1710000000.000100", text: "thread reply" }));

    const useCase = new BuildSlackHistoryContextUseCase(history);
    const context = await useCase.execute({
      currentEvent: event({ messageTs: "1710000100.000100" }),
      scope: "channel_with_threads",
      days: 1,
    });

    expect(context).toContain("channel root");
    expect(context).toContain("thread reply");
  });
});

function event(overrides: Partial<SlackWorkerRequest> = {}): SlackWorkerRequest {
  return {
    source: "slack",
    teamId: "T123",
    channelId: "C123",
    userId: "U123",
    text: "hello",
    messageTs: "1710000000.000100",
    channelType: "channel",
    isMention: false,
    isThreadMessage: Boolean(overrides.threadTs),
    idempotencyKey: `Ev-${overrides.messageTs ?? "default"}-${overrides.threadTs ?? "root"}`,
    processingIntent: "capture",
    ...overrides,
  };
}
