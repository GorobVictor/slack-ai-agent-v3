# Agent Guidance

This repository uses Cursor rules and skills to guide agent work. The primary project rules live in `.cursor/rules/` and should be treated as the source of truth for architecture, language policy, planning, and repository workflow. This file is the repository-local operational guide for agents working in this codebase.

## Project Purpose

This project is a Slack AI agent built around this runtime flow:

```text
Node.js Slack Listener -> Cloudflare Worker -> @cloudflare/think Agent
```

The listener is a thin Slack Socket Mode bridge. The Worker is the application boundary. `@cloudflare/think` owns durable AI conversation execution. D1 stores passive Slack history for summaries and context.

## Language Policy

- Write all repository content in English, including code, comments, docs, prompts, rules, commit messages, and configuration text.
- Reply to the user in the same language they use.
- If a plan is discussed in another language, save approved plan documents in English under `proto/features/`.
- Keep identifiers, paths, examples, and API names unchanged when translating plan content into repository files.

## Architecture Rules

- Use feature-first modular hexagonal architecture for Worker code.
- Prefer `Worker Handler -> Use Case -> Port -> Adapter -> External Service`.
- Prefer `Think Tool -> Use Case -> Port -> Adapter -> External Service` for agent tools.
- Keep entrypoints thin. Do not put business logic directly in `fetch()` or listener bootstrap code.
- Keep Cloudflare bindings, Slack API calls, D1 access, Durable Object access, Workers AI access, and external HTTP calls behind ports and adapters.
- Use dependency injection through constructors or composition roots.
- Avoid broad generic folders for new business logic. Prefer modules that match the feature owner.
- Keep helpers small. Only move shared technical utilities to `src/tools/` when they are generic and reused.

## Runtime Entrypoints

- Listener entrypoint: `src/cmd/listener/index.ts`.
- Worker entrypoint: `src/cmd/worker/index.ts`.
- Run the listener locally with `npm run listener:slack`.
- Run the Worker locally with `npm run worker:dev`.
- Deploy the Worker with `npm run worker:deploy`.
- Typecheck with `npm run typecheck`.
- Run tests with `npm test`.

## Slack Listener Rules

- The listener connects to Slack through Socket Mode and must stay thin.
- Slack SDK usage belongs in `src/adapters/slack/slack-socket-mode.adapter.ts`.
- Worker HTTP delivery belongs behind `WorkerEventClientPort`.
- The listener may normalize Slack payloads, decide `processingIntent`, forward events to the Worker, post Worker replies back to Slack, and capture posted bot replies.
- The listener must not run AI logic, call Workers AI, call D1, call Durable Object storage, perform RAG, or execute Think tools.
- Do not add long-term memory or business workflows to the listener.

## Slack Event Flow

Incoming Slack messages are normalized into shared Slack event contracts before reaching the Worker.

Important behavior:

- Bot-visible Slack messages are forwarded to the Worker.
- Direct messages use `processingIntent: "invoke"`.
- Explicit bot mentions and `app_mention` events use `processingIntent: "invoke"`.
- Unmentioned channel, group, MPIM, and thread messages use `processingIntent: "capture"`.
- MPIM is channel-like in the current version: capture everything visible, invoke only on mention.
- Tracked thread state may still exist as listener metadata, but tracked thread replies without a mention must not invoke Think.
- Message edits and deletes are currently ignored by the normalizer.
- File/share events can be retained when they have attachments/files, but file bytes are not stored.

## Idempotency Rules

- Slack can deliver overlapping events for the same user-visible message, such as both `app_mention` and `message.groups`.
- Use stable message identity for listener idempotency: `slack:{teamId}:{channelId}:{messageTs}` unless a stronger user-message identity is explicitly required.
- Do not use Slack `event_id` as the only idempotency key for message history, because separate Slack event envelopes can represent the same message.
- D1 history persistence must remain idempotent.
- Duplicate invoke events must not call Think again.
- Duplicate capture events should return `no_reply` behavior and must not post to Slack.

## Worker Rules

- The Worker exposes `POST /slack/events` for listener-to-Worker delivery.
- The Worker validates the internal bearer token using `WORKER_INTERNAL_API_TOKEN`.
- The Worker validates request payloads before executing use cases.
- The Worker composition root may create adapters from `env`, but use cases must depend on ports.
- The Worker must save Slack history before deciding whether to invoke Think.
- The Worker invokes Think only when `processingIntent === "invoke"`.
- Capture-only events return `no_reply` and must not call Think.
- Do not access `env.AI`, `env.SLACK_HISTORY_DB`, `env.SLACK_THINK_AGENT`, or other bindings directly inside use cases.

## Think Agent Rules

- Use `@cloudflare/think` as the default AI runtime.
- The Think agent class lives in `src/modules/agent/think-agent.ts`.
- Think-specific adapters live under `src/adapters/think/`.
- Keep `@cloudflare/think` imports in Think-specific files only.
- Prompts belong near the agent module, such as `src/modules/agent/agent.prompts.ts`.
- Tools exposed to Think should be small, typed, and validated with schemas.
- Think tools must call use cases and ports, not storage or Slack APIs directly.
- Do not manually build a custom LLM loop unless the user explicitly asks for it.
- The default Workers AI model is configured by `AI_MODEL` in `wrangler.jsonc`.
- Cloudflare AI Gateway is configured by `AI_GATEWAY_ID` in `wrangler.jsonc`; use `default` unless a named gateway is required.
- Runtime skills come only from D1-backed generated skills through `createSlackAgentSkillSources()`.
- Do not add repository skill manifests for runtime skills.
- After a successful invoked Slack turn, `SlackThinkAgent` runs `ReflectOnSlackConversationForSkillUseCase` to extract reusable workflows, compare them with the current generated skill catalog, validate decisions with `generated-skill-policy`, and save approved create or update decisions into D1.
- Generated skills are universal and not scoped to workspace, channel, thread, or user.
- Disable a generated skill by setting `disabled = 1` in D1; disabled skills remain stored but are not loaded by Think.

## Generated Skills Rules

- Generated skills are stored through `GeneratedSkillPort`.
- D1 access belongs in `src/adapters/storage/d1-generated-skill.adapter.ts`.
- In-memory storage belongs in `src/adapters/storage/in-memory-generated-skill.adapter.ts` and is primarily for tests.
- The D1 table is `generated_skills`.
- The D1 binding is `SLACK_HISTORY_DB` (same database as Slack history).
- Think loads enabled skills through `src/modules/agent/generated-skill-source.ts`.
- Auto-approval policy lives in `src/modules/agent/generated-skill-policy.ts`.
- Post-turn reflection lives in `src/modules/agent/skill-reflection.use-case.ts`.
- Generated skill bodies are typed as `GeneratedSkillBody`, stored in `body_json`, and rendered to canonical markdown with `src/modules/agent/generated-skill-body.ts`.
- Skill reflection returns a `skip`, `create`, or `update` decision. Updates mark the current row `is_old = 1` and insert a new row with the next version.
- Runtime loading must only use current enabled skills where `disabled = 0` and `is_old = 0`.
- Generated skills may only declare `getSlackHistoryContext` as an allowed tool.

## Slack History Rules

- Passive Slack history is stored through `SlackMessageHistoryPort`.
- D1 access belongs in `src/adapters/storage/d1-slack-message-history.adapter.ts`.
- In-memory history belongs in `src/adapters/storage/in-memory-slack-message-history.adapter.ts` and is primarily for tests.
- The D1 table is `slack_messages`.
- The D1 binding is `SLACK_HISTORY_DB`.
- D1 migrations live in `migrations/`.
- Summaries read captured history through query methods on `SlackMessageHistoryPort`.
- Current summary scopes are `thread`, `channel`, and `channel_with_threads`.
- The Think tool `getSlackHistoryContext` should be used before summarizing recent Slack discussion.

History capture includes:

- User messages the bot can see after the listener is running.
- Channel, group, MPIM, thread, and DM messages visible to the bot.
- Bot replies after Slack accepts the posted reply and returns a Slack message timestamp.

History capture does not currently include:

- Backfilled messages from before the listener was running.
- Message edits or deletes.
- File bytes or attachment contents.
- Private channel content unless the bot is a member.

## Bot Reply Capture

- Worker replies are posted to Slack by the listener.
- `SlackMessengerPort.sendMessage()` returns the posted Slack message timestamp.
- After a successful Slack post, the listener sends a second Worker event for the bot reply with `processingIntent: "capture"`.
- Bot reply capture uses `userId = botUserId`.
- Bot reply capture must not invoke Think again.
- Bot replies should flow through the same Worker and D1 history path as user messages.

## Ports And Adapters

Use existing ports before adding new ones:

- `WorkerEventClientPort` for listener-to-Worker HTTP delivery.
- `SlackMessengerPort` for posting Slack messages.
- `SlackSocketPort` for Slack Socket Mode listening.
- `ThinkSessionPort` for Worker-to-Think submission.
- `SlackMessageHistoryPort` for D1-backed Slack history.
- `GeneratedSkillPort` for D1-backed generated agent skills.
- `TrackedThreadStorePort` for listener-side tracked thread metadata.
- `LoggerPort` for structured logging.

Adapter boundaries:

- Slack SDK: `src/adapters/slack/`.
- Worker HTTP client: `src/adapters/worker/`.
- Think session bridge: `src/adapters/think/`.
- Storage: `src/adapters/storage/`.
- Logger: `src/adapters/logger/`.

## Environment And Configuration

Listener environment values are loaded from `.env` for local development. Never commit `.env`.

Required listener variables:

```text
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
WORKER_SLACK_EVENT_URL
WORKER_INTERNAL_API_TOKEN
```

Optional listener variables:

```text
SLACK_BOT_USER_ID
LOG_LEVEL
```

Worker configuration lives in `wrangler.jsonc`.
Use `.dev.vars` for local Worker secrets and create it from `.dev.vars.example`.

Important Worker bindings and vars:

```text
AI
AI_GATEWAY_ID
AI_MODEL
SLACK_THINK_AGENT
SLACK_HISTORY_DB
WORKER_INTERNAL_API_TOKEN
```

When creating a new D1 database, update the `database_id` in `wrangler.jsonc`.

## D1 Operations

Create the D1 database when needed:

```sh
npx wrangler d1 create slack-ai-agent-v3-history
```

Apply migrations locally:

```sh
npx wrangler d1 migrations apply slack-ai-agent-v3-history --local
```

Apply migrations remotely:

```sh
npx wrangler d1 migrations apply slack-ai-agent-v3-history --remote
```

Use `--local` for local `wrangler dev` storage and `--remote` for deployed Cloudflare D1.

## Testing Rules

- Use Vitest for tests.
- Prefer use case tests with mocked ports.
- Do not call real Slack, real Cloudflare services, real Workers AI, or real Think runtime in unit tests.
- Test boundary validation, event normalization, listener decisions, idempotency, Worker use cases, history adapters, and summary context formatting.
- Add regression tests for Slack duplicate delivery behavior whenever changing idempotency logic.
- Keep tests close to the module under test.

Current focused test areas:

- `src/modules/slack-listener/slack-event-normalizer.test.ts`.
- `src/modules/slack-listener/slack-event-filter.test.ts`.
- `src/modules/slack-listener/slack-listener.use-case.test.ts`.
- `src/modules/slack/handle-slack-message.use-case.test.ts`.
- `src/modules/slack/slack.handler.test.ts`.
- `src/modules/slack/slack-history-summary.use-case.test.ts`.
- `src/adapters/storage/d1-slack-message-history.adapter.test.ts`.
- `src/adapters/storage/d1-generated-skill.adapter.test.ts`.
- `src/modules/agent/generated-skill-policy.test.ts`.
- `src/modules/agent/generated-skill-body.test.ts`.
- `src/modules/agent/generated-skill-source.test.ts`.
- `src/modules/agent/skill-reflection.use-case.test.ts`.
- `src/modules/agent/agent.skills.test.ts`.

## Verification

Run these before completing TypeScript changes:

```sh
npm run typecheck
npm test
```

For Worker/config changes, also run:

```sh
npx wrangler deploy --dry-run
```

For D1 migration changes, validate locally when practical:

```sh
npx wrangler d1 migrations apply slack-ai-agent-v3-history --local
```

If the project has an active local `wrangler dev`, remember that local D1 state can differ between Miniflare instances. Reapply migrations or restart dev if the Worker reports missing D1 tables.

## Planning Workflow

- Save approved Plan Mode plans under `proto/features/`.
- Use the next sequential feature number.
- Use the date format `YYYY-MM-DD`.
- Use a short lowercase kebab-case feature name.
- Repository feature docs must be written in English.
- Do not edit `.cursor/plans/*` plan files unless explicitly instructed.

## Commit Workflow

Use the local `gen-commits` skill when splitting uncommitted work into commits.

Commit subjects must use this format:

```text
{tag}: {commit name}
```

Allowed tags:

```text
feat
test
fix
ref
migration
```

Commit bodies should explain the purpose and important context for each change.

Commit rules:

- Create local commits only.
- Never push unless the user explicitly asks.
- Never use force operations unless the user explicitly asks and the risk is understood.
- Do not commit `checkpoint.md`.
- Do not commit secrets, `.env`, local databases, `.wrangler/state`, `.DS_Store`, or generated local artifacts.
- Keep code/config/test/docs commits logically separated when practical.
- After code/config commits, check whether `README.md` and `AGENTS.md` need updates and commit docs separately if they changed.

## Security Rules

- Never hardcode Slack tokens, Worker internal tokens, API keys, or Cloudflare secrets.
- Do not log secrets.
- Avoid logging full user messages unless necessary for local debugging and explicitly acceptable.
- Authenticate internal listener-to-Worker requests.
- Validate all external input at the boundary.
- Treat model-generated tool arguments as untrusted and validate them.

## Cleanup Rules

- Be conservative when deleting files or abstractions.
- Do not remove future-facing architecture pieces if they are referenced by rules, docs, tests, or planned flows.
- Before removing code, search for imports, tests, config references, and README/AGENTS references.
- Do not remove migrations that may have been applied.
- Do not remove plan documents in `proto/features/`.
- Do not delete local state files unless the user explicitly asks for local cleanup.
