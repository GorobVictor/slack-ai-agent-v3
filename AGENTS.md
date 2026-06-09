# Agent Guidance

This repository uses Cursor rules and skills to guide agent work. The primary project rules live in `.cursor/rules/` and should be treated as the source of truth for architecture, language policy, planning, and repository workflow.

## Key Rules

- Use feature-first modular hexagonal architecture for Worker code.
- Keep the Node.js Slack listener thin and separate from Worker business logic.
- Use `@cloudflare/think` as the default runtime for AI agent behavior.
- Keep Cloudflare bindings, Slack API calls, storage, and other external services behind ports and adapters.
- Write repository content in English.
- Save approved Plan Mode plans under `proto/features/`.
- Do not commit `checkpoint.md`, secrets, or local artifacts such as `.DS_Store`.

## Commit Workflow

Use the local `gen-commits` skill when splitting uncommitted work into commits. Commit subjects must use this format:

```text
{tag}: {commit name}
```

Allowed tags are `feat`, `test`, `fix`, `ref`, and `migration`. Commit bodies should explain the purpose and important context for each change.
