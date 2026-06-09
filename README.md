# Slack AI Agent v3

This repository is for a Slack AI agent built around a thin Node.js Slack Socket Mode listener, a Cloudflare Worker application boundary, and `@cloudflare/think` for durable AI agent sessions.

## Architecture Direction

The intended runtime flow is:

```txt
Node.js Slack Listener -> Cloudflare Worker -> @cloudflare/think Agent
```

The Worker should stay thin at the entrypoint and delegate behavior through use cases, ports, and adapters. Slack-specific logic belongs in Slack modules or adapters, Think-specific logic belongs in the agent module or Think adapters, and storage access belongs behind port interfaces.

## Repository Guidance

Project-specific agent rules are stored in `.cursor/rules/`. The local `gen-commits` skill in `.cursor/skills/gen-commits/` defines the repository commit workflow for grouping uncommitted changes into local commits.

See `AGENTS.md` for the short operational guide used by coding agents.
