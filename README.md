# Slack AI Agent v3

This repository is for a Slack AI agent built around a thin Node.js Slack Socket Mode listener, a Cloudflare Worker application boundary, and `@cloudflare/think` for durable AI agent sessions.

## Architecture Direction

The intended runtime flow is:

```txt
Node.js Slack Listener -> Cloudflare Worker -> @cloudflare/think Agent
```

The Worker should stay thin at the entrypoint and delegate behavior through use cases, ports, and adapters. Slack-specific logic belongs in Slack modules or adapters, Think-specific logic belongs in the agent module or Think adapters, and storage access belongs behind port interfaces.

## Slack Listener

The Node.js Slack listener entrypoint is `src/cmd/listener/index.ts`. It connects to Slack through Socket Mode, normalizes bot-visible message events, marks each event as `capture` or `invoke`, forwards it to the Worker HTTP endpoint, and posts Worker replies back to Slack.

Run it locally with:

```sh
npm run listener:slack
```

Create a local `.env` from the committed template:

```sh
cp .env.example .env
```

Required environment variables:

```txt
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
WORKER_SLACK_EVENT_URL
WORKER_INTERNAL_API_TOKEN
```

Optional environment variables:

```txt
SLACK_BOT_USER_ID
LOG_LEVEL
```

Use `npm run typecheck` and `npm test` before committing listener changes.

## Cloudflare Worker

The Worker entrypoint is `src/cmd/worker/index.ts`. It exposes `POST /slack/events`, validates the internal bearer token, saves each message to D1 idempotently, resolves a deterministic Slack session id for invoke events, calls `SlackThinkAgent` through a Think session port, and returns a JSON reply for the listener to post.

Run the Worker locally with:

```sh
npm run worker:dev
```

Deploy it with:

```sh
npm run worker:deploy
```

Required Worker secret:

```txt
WORKER_INTERNAL_API_TOKEN
```

Create the Slack history D1 database before deployment, then replace the placeholder `database_id` in `wrangler.jsonc`:

```sh
npx wrangler d1 create slack-ai-agent-v3-history
npx wrangler d1 migrations apply slack-ai-agent-v3-history
```

Worker bindings and non-secret defaults are configured in `wrangler.jsonc`:

```txt
AI
SLACK_THINK_AGENT
SLACK_HISTORY_DB
AI_MODEL
```

The listener sends `SlackWorkerRequest` JSON. Channel, group, and MPIM messages without a bot mention are forwarded as `processingIntent: "capture"` and return `no_reply`. Direct messages and explicit bot mentions use `processingIntent: "invoke"` and may return a reply.

The Worker returns one of:

```json
{ "status": "reply", "text": "Message text", "threadTs": "1710000000.000100" }
```

```json
{ "status": "no_reply", "reason": "empty_agent_reply" }
```

```json
{ "status": "no_reply", "reason": "capture_only" }
```

```json
{ "status": "error", "code": "SLACK_EVENT_INVALID", "message": "Slack event payload is invalid" }
```

Captured Slack history is stored in the `slack_messages` D1 table. The Think agent has a bounded `getSlackHistoryContext` tool for summarizing recent history by `thread`, `channel`, or `channel_with_threads`.

Use `npm run typecheck`, `npm test`, and `npx wrangler deploy --dry-run` before deploying Worker changes.

## Repository Guidance

Project-specific agent rules are stored in `.cursor/rules/`. The local `gen-commits` skill in `.cursor/skills/gen-commits/` defines the repository commit workflow for grouping uncommitted changes into local commits.

See `AGENTS.md` for the short operational guide used by coding agents.
