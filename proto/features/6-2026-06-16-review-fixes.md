# Review Fixes

## Scope

Implement only the confirmed fixes from `REVIEW.md`:

- Add retry and fallback behavior for Slack replies.
- Move Slack history tool composition behind a small port-based boundary.
- Add a Worker local development `.dev.vars.example`.
- Validate that `WORKER_SLACK_EVENT_URL` targets `/slack/events`.

Do not change duplicate invoke behavior, the synchronous Worker-to-Think path, bot reply thread metadata, or the `client_msg_id` idempotency rule.

Keep the implementation small and avoid repeated code. Reuse the existing `retry()` helper, existing ports, existing types, and local test helpers where practical.

## Implementation Plan

1. Update `src/modules/slack-listener/slack-listener.use-case.ts`.
   - Publish successful Worker replies through retry: 3 attempts with 1 second between attempts.
   - If Worker delivery fails for an invoke event, send a fallback Slack reply in the same thread.
   - If Worker returns `status: "error"`, send the same fallback Slack reply.
   - If fallback sending fails, log the failure and stop.
   - Keep bot reply capture unchanged after successful Slack posting.

2. Add listener regression tests in `src/modules/slack-listener/slack-listener.use-case.test.ts`.
   - Cover retrying Slack reply publishing.
   - Cover fallback when Worker delivery fails.
   - Cover fallback when Worker returns an error response.
   - Keep no-reply and capture-only behavior unchanged.

3. Move Think history tool logic into a small agent tool helper.
   - Add a helper near the agent module that accepts `SlackMessageHistoryPort`.
   - Keep the tool schema and execution logic out of `SlackThinkAgent.getTools()`.
   - Keep `think-agent.ts` as the runtime composition point for binding-backed adapters.

4. Add focused tests for the agent tool helper.
   - Verify behavior when no Slack turn is active.
   - Verify that Slack history is read through the injected history port.

5. Add `.dev.vars.example`.
   - Include `WORKER_INTERNAL_API_TOKEN`.
   - Include `AI_MODEL` as a local Worker override matching `wrangler.jsonc`.

6. Strengthen listener environment validation in `src/shared/env.ts`.
   - Require `WORKER_SLACK_EVENT_URL` to use the `/slack/events` path.
   - Add focused tests for valid and invalid URLs.

7. Update documentation only where needed.
   - Mention `.dev.vars.example` in the README environment setup.
   - Clarify that `WORKER_SLACK_EVENT_URL` should point to `/slack/events`.

8. Verify the implementation.
   - Run `npm run typecheck`.
   - Run `npm test`.
   - Run `npx wrangler deploy --dry-run` when the environment allows it.

## Expected Outcome

The listener becomes more resilient to transient Worker and Slack failures, local Worker setup becomes clearer, listener configuration catches wrong Worker URLs earlier, and the Slack history Think tool better follows the project's ports-and-adapters architecture without a broad refactor.
