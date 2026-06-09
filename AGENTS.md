# Agent Guidance

This repository uses Cursor rules and skills to guide agent work. The primary project rules live in `.cursor/rules/` and should be treated as the source of truth for architecture, language policy, planning, and repository workflow.

## Key Rules

- Use feature-first modular hexagonal architecture for Worker code.
- Keep the Node.js Slack listener thin and separate from Worker business logic.
- The Slack listener entrypoint is `src/cmd/listener/index.ts`; run it with `npm run listener:slack`.
- The Worker entrypoint is `src/cmd/worker/index.ts`; run it locally with `npm run worker:dev`.
- Use `@cloudflare/think` as the default runtime for AI agent behavior.
- Keep `@cloudflare/think` imports in Think-specific agent or adapter files such as `src/modules/agent/think-agent.ts` and `src/adapters/think/think-session.adapter.ts`.
- Keep Cloudflare bindings, Slack API calls, storage, and other external services behind ports and adapters.
- Write repository content in English.
- Save approved Plan Mode plans under `proto/features/`.
- Do not commit `checkpoint.md`, secrets, or local artifacts such as `.DS_Store`.

## Verification

Run `npm run typecheck` and `npm test` before committing TypeScript changes. For Worker changes, also run `npx wrangler deploy --dry-run` when Wrangler is available and configured.

## Commit Workflow

Use the local `gen-commits` skill when splitting uncommitted work into commits. Commit subjects must use this format:

```text
{tag}: {commit name}
```

Allowed tags are `feat`, `test`, `fix`, `ref`, and `migration`. Commit bodies should explain the purpose and important context for each change.
