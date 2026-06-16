import { describe, expect, it } from "vitest";

import { loadListenerEnv } from "./env.js";

describe("loadListenerEnv", () => {
  it("loads listener env when Worker Slack event URL targets /slack/events", () => {
    expect(loadListenerEnv(env())).toMatchObject({
      slackBotToken: "xoxb-token",
      slackAppToken: "xapp-token",
      workerSlackEventUrl: "http://localhost:8787/slack/events",
      workerInternalApiToken: "local-token",
      logLevel: "info",
    });
  });

  it("rejects Worker Slack event URLs that do not target /slack/events", () => {
    expect(() =>
      loadListenerEnv(
        env({
          WORKER_SLACK_EVENT_URL: "http://localhost:8787",
        }),
      ),
    ).toThrow("WORKER_SLACK_EVENT_URL must target /slack/events");
  });
});

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    SLACK_BOT_TOKEN: "xoxb-token",
    SLACK_APP_TOKEN: "xapp-token",
    WORKER_SLACK_EVENT_URL: "http://localhost:8787/slack/events",
    WORKER_INTERNAL_API_TOKEN: "local-token",
    ...overrides,
  };
}
