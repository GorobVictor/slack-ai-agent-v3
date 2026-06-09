# Slack Socket Mode Listener

## Overview

Implement a thin Node.js Slack Socket Mode listener that normalizes eligible Slack events and forwards them to the Cloudflare Worker over HTTP. Slack SDK details and Worker HTTP delivery stay behind adapters. The listener must not contain AI logic, `@cloudflare/think` logic, RAG logic, Cloudflare storage logic, or business logic.

## Architecture

```txt
Slack Socket Mode
  -> Slack socket adapter
  -> Slack listener use case
  -> Worker event client port
  -> Worker HTTP adapter
  -> Cloudflare Worker
```

The listener entrypoint at `src/cmd/listener/index.ts` is a composition root only. It loads and validates environment, creates adapters, creates the use case, and starts the Slack listener.

## Implementation Steps

1. Create listener ports for Slack Socket Mode, Worker event delivery, tracked thread storage, and logging.
2. Add shared environment validation, typed errors, a small result helper if needed, and retry utilities.
3. Implement the Slack listener module:
   - normalized Slack event types
   - Slack event normalization
   - pure filtering decisions
   - tracked thread key generation and store orchestration
   - main listener use case
4. Implement adapters:
   - Slack Socket Mode adapter using `@slack/bolt`
   - Worker HTTP event client using `fetch`
   - in-memory tracked thread store
5. Wire everything in `src/cmd/listener/index.ts`.
6. Add a VS Code launch configuration for the listener.
7. Add a `listener:slack` package script.
8. Add focused tests for pure listener logic.
9. Run typecheck and tests.

## Constraints

- Only `src/adapters/slack/slack-socket-mode.adapter.ts` imports the Slack SDK.
- Only `src/adapters/worker/worker-event-client.adapter.ts` sends HTTP requests to the Worker.
- Listener code does not import `@cloudflare/think`.
- Listener code does not use Cloudflare bindings or storage.
- Channel and group messages are forwarded only when the bot is mentioned or the thread is already tracked.
- Direct messages are forwarded by default.
- Logs include safe metadata only and never include secrets or full message text by default.
