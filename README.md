# Slack AI Agent v3

This repository is for a Slack AI agent built around a thin Node.js Slack Socket Mode listener, a Cloudflare Worker application boundary, and `@cloudflare/think` for durable AI agent sessions.

## Architecture Direction

The intended runtime flow is:

```txt
Node.js Slack Listener -> Cloudflare Worker -> @cloudflare/think Agent
```

The Worker should stay thin at the entrypoint and delegate behavior through use cases, ports, and adapters. Slack-specific logic belongs in Slack modules or adapters, Think-specific logic belongs in the agent module or Think adapters, and storage access belongs behind port interfaces.

## Slack Listener

The Node.js Slack listener entrypoint is `src/cmd/listener/index.ts`. It connects to Slack through Socket Mode, normalizes eligible message events, tracks mentioned threads in memory, and forwards accepted events to the Worker HTTP endpoint.

Run it locally with:

```sh
npm run listener:slack
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

## Repository Guidance

Project-specific agent rules are stored in `.cursor/rules/`. The local `gen-commits` skill in `.cursor/skills/gen-commits/` defines the repository commit workflow for grouping uncommitted changes into local commits.

See `AGENTS.md` for the short operational guide used by coding agents.
