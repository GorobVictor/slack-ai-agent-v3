# Agent Guidance

This file is the repository-local operating guide for coding agents working in `slack-ai-agent-v3`. Treat it as a practical companion to the Cursor rules in `.cursor/rules/`. The Cursor rules are still the source of truth for global behavior, architecture, language policy, planning workflow, and repository workflow. This file explains how to apply those rules in this codebase.

## First Principles

This project is a Slack AI agent with this runtime shape:

```text
Node.js Slack Listener -> Cloudflare Worker -> @cloudflare/think Agent
```

The listener is a thin Slack bridge. The Worker is the application boundary. `@cloudflare/think` owns durable AI conversation execution. D1 stores passive Slack history and generated skills. Cloudflare Queues run generated-skill reflection after successful invoked Slack turns.

Use feature-first modular hexagonal architecture:

```text
Entrypoint -> Use Case -> Port -> Adapter -> External Service
Think Tool -> Use Case -> Port -> Adapter -> External Service
```

Keep the code boring, explicit, typed, and replaceable. Prefer existing local patterns over new abstractions.

## Language Policy

- Reply to the user in the same language they use.
- Write all repository content in English.
- Repository content includes code, comments, docs, prompts, rules, skills, commit messages, config text, and test names.
- If a user discusses a plan in another language, save approved plan documents in English under `proto/features/`.
- Preserve identifiers, API names, file paths, commands, and code snippets when translating plan content.
- Do not add localized repository content unless the user explicitly asks for localization as the deliverable.

## Current Architecture Snapshot

The important runtime pieces are:

- `src/cmd/listener/index.ts`: Node.js Slack Socket Mode listener bootstrap.
- `src/cmd/worker/index.ts`: Cloudflare Worker fetch handler and Queue consumer.
- `src/modules/slack-listener/`: listener-side Slack event normalization, filtering, thread metadata, and orchestration.
- `src/modules/slack/`: Worker-side request validation, Slack session resolution, message handling, and Slack history context.
- `src/modules/agent/`: Think agent, tools, generated skills, AI model creation, reflection, and reflection jobs.
- `src/ports/`: boundary interfaces used by use cases.
- `src/adapters/`: concrete integrations with Slack, Worker HTTP, D1, Cloudflare Queue, Think, and logging.
- `src/prompts/`: all model-facing text and prompt builders.
- `src/shared/`: shared app errors and environment validation.
- `src/tools/`: generic technical helpers only.
- `migrations/`: D1 schema migrations.

The Worker currently composes:

- `ThinkSessionAdapter` over the `SLACK_THINK_AGENT` Durable Object namespace.
- `D1SlackMessageHistoryAdapter` over `SLACK_HISTORY_DB`.
- `CloudflareSkillReflectionQueueAdapter` over `SKILL_REFLECTION_QUEUE`.
- `D1GeneratedSkillAdapter` over `SLACK_HISTORY_DB`.
- `D1SkillReflectionJobLedgerAdapter` over `SLACK_HISTORY_DB`.
- `ConsoleLoggerAdapter` for structured logs.

## Runtime Entrypoints And Commands

Entrypoints:

- Listener entrypoint: `src/cmd/listener/index.ts`.
- Worker entrypoint: `src/cmd/worker/index.ts`.
- Think agent class: `src/modules/agent/think-agent.ts`.

Commands:

- Run the listener locally: `npm run listener:slack`.
- Run the Worker locally: `npm run worker:dev`.
- Deploy the Worker: `npm run worker:deploy`.
- Build TypeScript: `npm run build`.
- Typecheck: `npm run typecheck`.
- Run tests: `npm test`.
- Run built listener: `npm start`.

Verification expectations:

- For TypeScript behavior changes, run `npm run typecheck` and `npm test`.
- For Worker/config changes, also run `npx wrangler deploy --dry-run`.
- For D1 migration changes, validate locally when practical with `npx wrangler d1 migrations apply slack-ai-agent-v3-history --local`.
- If you cannot run verification, say why in the final response.

## Architectural Boundaries

Use cases must depend on ports, not concrete services.

Allowed in use cases:

- Port interfaces from `src/ports/`.
- Module-owned types.
- Pure functions.
- Shared application errors and result types.
- Generic helpers from `src/tools/` when appropriate.

Not allowed in use cases:

- Direct `env` access.
- Direct D1 access.
- Direct Slack SDK calls.
- Direct Workers AI calls.
- Direct Durable Object namespace access.
- Direct Queue binding access.
- Direct `fetch()` to external services unless the use case is explicitly about a port abstraction and the dependency has been intentionally modeled.

Adapters may depend on concrete SDKs and bindings. Entrypoints may compose adapters from `env`. Prompt files may contain model-facing text, but must not contain business orchestration.

## Listener Rules

The listener connects to Slack through Socket Mode and must stay thin.

Listener responsibilities:

- Load and validate local listener environment.
- Connect to Slack Socket Mode.
- Acknowledge Slack Socket Mode envelopes quickly.
- Normalize raw Slack message events.
- Decide whether an event should be ignored, captured, or used to invoke Think.
- Build and preserve idempotency metadata.
- Send normalized events to the Worker.
- Post Worker replies to Slack through `SlackMessengerPort`.
- Capture posted bot replies after Slack returns a timestamp.
- Log operational errors.

Listener non-responsibilities:

- Do not run Think.
- Do not call Workers AI.
- Do not call D1, KV, R2, Vectorize, or Durable Object storage.
- Do not execute agent tools.
- Do not store long-term memory.
- Do not perform RAG.
- Do not add business workflows to listener bootstrap or Slack adapters.

Key listener files:

- `src/cmd/listener/index.ts`: composition only.
- `src/adapters/slack/slack-socket-mode.adapter.ts`: Slack SDK integration.
- `src/adapters/worker/worker-event-client.adapter.ts`: listener-to-Worker HTTP client.
- `src/adapters/storage/in-memory-tracked-thread-store.adapter.ts`: listener-side tracked thread metadata.
- `src/modules/slack-listener/slack-event-normalizer.ts`: raw Slack event normalization.
- `src/modules/slack-listener/slack-event-filter.ts`: capture/invoke/ignore decisions.
- `src/modules/slack-listener/slack-listener.use-case.ts`: listener orchestration.
- `src/modules/slack-listener/slack-thread-tracker.ts`: thread tracking helpers.

## Slack Event Behavior

Incoming Slack messages are normalized before reaching the Worker. Use `NormalizedSlackMessageEvent` and `SlackWorkerRequest`; do not pass raw Slack payloads into Worker use cases.

Current behavior:

- Direct messages use `processingIntent: "invoke"`.
- Explicit bot mentions use `processingIntent: "invoke"`.
- `app_mention` events use `processingIntent: "invoke"`.
- Channel messages without a bot mention use `processingIntent: "capture"`.
- Private channel messages without a bot mention use `processingIntent: "capture"`.
- MPIM is channel-like: capture visible messages, invoke only on mention.
- Tracked thread state may still exist as listener metadata, but tracked thread replies without a fresh mention must not invoke Think.
- Message edits are ignored.
- Message deletes are ignored.
- Hidden Slack events are ignored.
- Bot-authored Socket Mode events are ignored to avoid loops.
- Posted bot replies are captured explicitly after `chat.postMessage` returns a timestamp.
- File/share events may be retained when they include files or attachments, but file bytes are not stored.

When changing this behavior, update or add tests in:

- `src/modules/slack-listener/slack-event-normalizer.test.ts`.
- `src/modules/slack-listener/slack-event-filter.test.ts`.
- `src/modules/slack-listener/slack-listener.use-case.test.ts`.
- `src/modules/slack/handle-slack-message.use-case.test.ts` when Worker behavior changes.

## Idempotency Rules

Slack can send overlapping event envelopes for the same visible message. For example, one user-visible bot mention can arrive as both `app_mention` and `message.groups`.

Required behavior:

- Use stable message identity for listener idempotency.
- Prefer the shape `slack:{teamId}:{channelId}:{messageTs}` unless a stronger user-message identity is explicitly required.
- Do not use Slack `event_id` as the only history idempotency key.
- D1 history persistence must remain idempotent.
- Duplicate invoke events must not call Think again.
- Duplicate capture events must not post to Slack.
- Think turn replies should remain cached by idempotency key.
- Reflection jobs must remain idempotent through `skill_reflection_jobs`.

Important files:

- `src/modules/slack-listener/slack-event-normalizer.ts`.
- `src/modules/slack/handle-slack-message.use-case.ts`.
- `src/adapters/storage/d1-slack-message-history.adapter.ts`.
- `src/modules/agent/think-agent.ts`.
- `src/adapters/storage/d1-skill-reflection-job-ledger.adapter.ts`.
- `src/modules/agent/skill-reflection-job-runner.ts`.

Add regression tests whenever changing idempotency logic.

## Worker Rules

The Worker exposes `POST /slack/events` for listener-to-Worker delivery. All other routes are delegated to `routeAgentRequest()` so Think/Agents runtime routes can work.

Worker responsibilities:

- Validate the internal bearer token using `WORKER_INTERNAL_API_TOKEN`.
- Validate Slack event request JSON before executing use cases.
- Compose adapters from Cloudflare `env`.
- Save Slack history before deciding whether to invoke Think.
- Invoke Think only when `processingIntent === "invoke"`.
- Return `no_reply` for capture-only events.
- Return `no_reply` for duplicate messages.
- Enqueue skill reflection after successful invoked turns with non-empty replies.
- Consume reflection queue messages.
- Use the reflection job ledger to avoid duplicate completed jobs.

Worker non-responsibilities:

- Do not put business logic directly in `fetch()`.
- Do not directly query D1 inside handlers.
- Do not directly call Slack from Worker use cases.
- Do not directly call Workers AI from Slack use cases.
- Do not pass raw Cloudflare `env` into use cases.

Key Worker files:

- `src/cmd/worker/index.ts`: composition root, fetch route split, queue consumer.
- `src/modules/slack/slack.handler.ts`: HTTP validation and response mapping.
- `src/modules/slack/slack.validation.ts`: request validation.
- `src/modules/slack/handle-slack-message.use-case.ts`: Worker-side Slack message behavior.
- `src/adapters/cloudflare/cloudflare-skill-reflection-queue.adapter.ts`: queue producer.

## Think Agent Rules

Use `@cloudflare/think` as the default AI runtime.

Think responsibilities:

- Durable agent execution.
- Conversation state.
- Tool calling.
- Generated skill loading.
- Slack turn reply caching.
- Model invocation through the configured Workers AI model.

Think rules:

- Keep `@cloudflare/think` imports in Think-specific files only.
- The Think agent class belongs in `src/modules/agent/think-agent.ts`.
- Think-specific adapters belong in `src/adapters/think/`.
- Prompts and model-facing text belong in `src/prompts/`.
- Tools exposed to Think must validate input.
- Tools must call use cases and ports, not D1, Slack SDK, or Cloudflare bindings directly.
- Do not manually build a custom LLM loop unless explicitly requested.
- Do not invent `@cloudflare/think` APIs. Inspect installed types and existing code first.

Important Think files:

- `src/modules/agent/think-agent.ts`.
- `src/adapters/think/think-session.adapter.ts`.
- `src/ports/think-session.port.ts`.
- `src/modules/agent/agent.tools.ts`.
- `src/modules/agent/agent.skills.ts`.
- `src/modules/agent/generated-skill-source.ts`.
- `src/modules/agent/agent-model.ts`.
- `src/modules/agent/agent-ai-gateway.ts`.
- `src/prompts/agent.prompts.ts`.
- `src/prompts/agent-tools.prompts.ts`.

## Slack Session Strategy

Use deterministic session ids so Slack context maps consistently to Think state.

Default mapping:

```text
DM with bot:
slack:{teamId}:dm:{userId}

Slack thread:
slack:{teamId}:channel:{channelId}:thread:{threadTs}

Channel root message:
slack:{teamId}:channel:{channelId}:thread:{messageTs}
```

Thread-level sessions are preferred for channel conversations. Do not use the entire channel as one active Think chat session by default because it makes context noisy.

Session resolver:

- `src/modules/slack/slack-session-resolver.ts`.
- Tests: `src/modules/slack/slack-session-resolver.test.ts`.

## Slack History Rules

Passive Slack history is stored through `SlackMessageHistoryPort`.

Storage:

- D1 adapter: `src/adapters/storage/d1-slack-message-history.adapter.ts`.
- In-memory adapter: `src/adapters/storage/in-memory-slack-message-history.adapter.ts`.
- D1 table: `slack_messages`.
- D1 binding: `SLACK_HISTORY_DB`.

Captured history includes:

- User messages the bot can see after the listener starts.
- DMs.
- Channels where the bot can see messages.
- Private channels only when the bot is a member.
- MPIM messages visible to the bot.
- Thread replies visible to the bot.
- Bot replies after Slack accepts the posted reply.

Captured history does not currently include:

- Backfilled messages from before the listener was running.
- Message edits.
- Message deletes.
- File bytes.
- Full attachment contents.
- Private channel content when the bot is not a member.

Summary context:

- Built by `src/modules/slack/slack-history-summary.use-case.ts`.
- Prompt formatting lives in `src/prompts/slack-history.prompts.ts`.
- Exposed to Think through `getSlackHistoryContext`.
- Supported scopes are `thread`, `channel`, and `channel_with_threads`.

The agent should call `getSlackHistoryContext` before summarizing recent Slack discussion.

## Bot Reply Capture

Worker replies are posted to Slack by the listener, not by the Worker.

Required behavior:

- `SlackMessengerPort.sendMessage()` returns the posted Slack message timestamp.
- After Slack accepts the post, the listener sends a second Worker event for the bot reply.
- Bot reply capture uses `processingIntent: "capture"`.
- Bot reply capture uses `userId = botUserId`.
- Bot reply capture must not invoke Think.
- Bot replies should flow through the same Worker and D1 history path as user messages.

Important files:

- `src/modules/slack-listener/slack-listener.use-case.ts`.
- `src/ports/slack-messenger.port.ts`.
- `src/adapters/slack/slack-socket-mode.adapter.ts`.
- `src/modules/slack/handle-slack-message.use-case.ts`.

## Generated Skills Rules

Generated skills are D1-backed runtime skills learned from successful Slack turns.

Core rules:

- Generated skills are stored through `GeneratedSkillPort`.
- D1 adapter: `src/adapters/storage/d1-generated-skill.adapter.ts`.
- In-memory adapter: `src/adapters/storage/in-memory-generated-skill.adapter.ts`.
- D1 table: `generated_skills`.
- D1 binding: `SLACK_HISTORY_DB`.
- Runtime loading: `src/modules/agent/generated-skill-source.ts`.
- Skill body typing and rendering: `src/modules/agent/generated-skill-body.ts`.
- Auto-approval and rejection policy: `src/modules/agent/generated-skill-policy.ts`.
- Reflection use case: `src/modules/agent/skill-reflection.use-case.ts`.
- Queue payload validation: `src/modules/agent/skill-reflection-job.ts`.
- Queue job runner: `src/modules/agent/skill-reflection-job-runner.ts`.
- Queue producer port: `SkillReflectionQueuePort`.
- Queue job ledger port: `SkillReflectionJobLedgerPort`.
- Reflection job ledger table: `skill_reflection_jobs`.

Runtime skill rules:

- Runtime skills come only from D1-backed generated skills through `createSlackAgentSkillSources()`.
- Do not add repository skill manifests for runtime generated skills.
- Runtime loading must only use current enabled skills where `disabled = 0` and `is_old = 0`.
- Generated skills are universal and are not scoped to workspace, channel, thread, or user.
- Disable a generated skill by setting `disabled = 1`; do not delete it as the normal disable path.
- Generated skill updates mark the current row `is_old = 1` and insert a new row with the next version.
- Generated skills may only declare `getSlackHistoryContext` as an allowed tool.
- Generated skill bodies are stored as typed `body_json` and rendered to canonical markdown `body`.

Reflection rules:

- Reflection runs after successful invoked Slack turns.
- Reflection must not block the Slack reply.
- The Worker enqueues a reflection job after it has a non-empty assistant reply.
- Reflection jobs carry the Slack event and assistant reply.
- Reflection jobs do not use the Slack conversation Think `sessionId`.
- Reflection uses `REFLECTION_AI_MODEL`, not necessarily `AI_MODEL`.
- Reflection should use reduced Slack history context.
- Reflection should use reasoning-disabled model settings when supported.
- Reflection prompt/schema should stay compact to avoid routine extraction timeouts and truncated JSON.
- Model output is untrusted; TypeScript policy validation is required after parsing.
- The final reflection decision is `skip`, `create`, or `update`.
- Failed reflection queue messages should retry through the queue.
- Already completed reflection jobs should be acknowledged and skipped.

Tests to update when changing generated skills:

- `src/adapters/storage/d1-generated-skill.adapter.test.ts`.
- `src/adapters/storage/d1-skill-reflection-job-ledger.adapter.test.ts`.
- `src/modules/agent/generated-skill-policy.test.ts`.
- `src/modules/agent/generated-skill-body.test.ts`.
- `src/modules/agent/generated-skill-source.test.ts`.
- `src/modules/agent/skill-reflection-job.test.ts`.
- `src/modules/agent/skill-reflection.use-case.test.ts`.
- `src/modules/agent/agent.skills.test.ts`.
- `src/modules/agent/think-agent.test.ts` when runtime loading changes.

## Ports And Adapters

Use existing ports before adding new ones.

Current important ports:

- `WorkerEventClientPort`: listener-to-Worker HTTP delivery.
- `SlackMessengerPort`: posting Slack replies.
- `SlackSocketPort`: Slack Socket Mode listening.
- `ThinkSessionPort`: Worker-to-Think submission.
- `SlackMessageHistoryPort`: Slack history storage.
- `GeneratedSkillPort`: generated skill storage.
- `SkillReflectionQueuePort`: queue-backed post-turn reflection.
- `SkillReflectionJobLedgerPort`: reflection job idempotency ledger.
- `TrackedThreadStorePort`: listener-side tracked thread metadata.
- `LoggerPort`: structured logging.

Adapter boundaries:

- Slack SDK: `src/adapters/slack/`.
- Worker HTTP client: `src/adapters/worker/`.
- Cloudflare Queue: `src/adapters/cloudflare/`.
- Think bridge: `src/adapters/think/`.
- D1 and in-memory storage: `src/adapters/storage/`.
- Logger: `src/adapters/logger/`.

When adding a dependency:

1. Check whether an existing port already models the boundary.
2. If not, add a small port in `src/ports/`.
3. Inject the port into the use case.
4. Implement the concrete adapter under `src/adapters/`.
5. Wire the adapter in the entrypoint or composition root.
6. Add use case tests with fake or in-memory ports.
7. Add adapter tests where practical.

## Prompt Rules

All model-facing text belongs in `src/prompts/`.

Prompt files should:

- Be written in English.
- Include `Used by` comments when useful.
- Export prompt builders or constants.
- Keep model instructions readable and versionable.
- Avoid duplicating prompt text across modules.

Prompt files should not:

- Contain storage access.
- Contain Slack SDK calls.
- Contain Worker request handling.
- Contain business orchestration.
- Hide important policy that should be enforced in TypeScript.

Important prompt files:

- `src/prompts/agent.prompts.ts`.
- `src/prompts/agent-tools.prompts.ts`.
- `src/prompts/slack-history.prompts.ts`.
- `src/prompts/skill-reflection.prompts.ts`.
- `src/prompts/generated-skills.prompts.ts`.

## Environment And Configuration

Listener environment values are loaded from `.env`.

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

`WORKER_SLACK_EVENT_URL` must be a valid URL whose path is `/slack/events`.

Worker local secrets live in `.dev.vars`.

Important Worker bindings and vars:

```text
AI
AI_GATEWAY_ID
AI_MODEL
REFLECTION_AI_MODEL
SLACK_THINK_AGENT
SLACK_HISTORY_DB
SKILL_REFLECTION_QUEUE
WORKER_INTERNAL_API_TOKEN
```

`wrangler.jsonc` currently configures:

- `AI` Workers AI binding.
- `SLACK_HISTORY_DB` D1 binding.
- `SLACK_THINK_AGENT` Durable Object binding.
- `SKILL_REFLECTION_QUEUE` Queue producer binding.
- Queue consumer for generated-skill reflection.
- Dead letter queue for failed reflection jobs.
- `nodejs_compat` compatibility flag.
- Observability.

Never commit secrets, `.env`, `.dev.vars`, local Wrangler state, or local databases.

## D1 Operations

Create the D1 database when needed:

```sh
npx wrangler d1 create slack-ai-agent-v3-history
```

Apply local migrations:

```sh
npx wrangler d1 migrations apply slack-ai-agent-v3-history --local
```

Apply remote migrations:

```sh
npx wrangler d1 migrations apply slack-ai-agent-v3-history --remote
```

Current migrations:

- `migrations/0001_slack_messages.sql`: Slack history.
- `migrations/0002_generated_skills.sql`: generated skill storage.
- `migrations/0003_generated_skill_versions.sql`: generated skill version/current-row fields.
- `migrations/0004_skill_reflection_jobs.sql`: reflection job ledger.

Migration rules:

- Add new migrations for schema changes.
- Do not edit migrations that may have been applied.
- Do not delete migrations.
- Update tests for D1 adapters when schema changes.
- If local `wrangler dev` reports missing tables, reapply local migrations and restart dev if needed.

## Testing Rules

Use Vitest.

General testing guidance:

- Prefer use case tests with mocked ports.
- Prefer in-memory adapters for local behavior tests.
- Do not call real Slack in unit tests.
- Do not call real Cloudflare services in unit tests.
- Do not call real Workers AI in unit tests.
- Do not rely on real Think runtime in unit tests unless explicitly building an integration test.
- Test validation at boundaries.
- Test duplicate delivery behavior when idempotency changes.
- Keep tests close to the module under test.

Current focused test areas:

- `src/modules/slack-listener/slack-event-normalizer.test.ts`.
- `src/modules/slack-listener/slack-event-filter.test.ts`.
- `src/modules/slack-listener/slack-listener.use-case.test.ts`.
- `src/modules/slack-listener/slack-thread-tracker.test.ts`.
- `src/modules/slack/handle-slack-message.use-case.test.ts`.
- `src/modules/slack/slack.handler.test.ts`.
- `src/modules/slack/slack-session-resolver.test.ts`.
- `src/modules/slack/slack-history-summary.use-case.test.ts`.
- `src/adapters/storage/d1-slack-message-history.adapter.test.ts`.
- `src/adapters/storage/d1-generated-skill.adapter.test.ts`.
- `src/adapters/storage/d1-skill-reflection-job-ledger.adapter.test.ts`.
- `src/adapters/cloudflare/cloudflare-skill-reflection-queue.adapter.test.ts`.
- `src/adapters/slack/slack-socket-mode.adapter.test.ts`.
- `src/adapters/worker/worker-event-client.adapter.test.ts`.
- `src/adapters/logger/console-logger.adapter.test.ts`.
- `src/modules/agent/agent.tools.test.ts`.
- `src/modules/agent/agent.skills.test.ts`.
- `src/modules/agent/generated-skill-policy.test.ts`.
- `src/modules/agent/generated-skill-body.test.ts`.
- `src/modules/agent/generated-skill-source.test.ts`.
- `src/modules/agent/skill-reflection-job.test.ts`.
- `src/modules/agent/skill-reflection.use-case.test.ts`.
- `src/modules/agent/think-agent.test.ts`.
- `src/prompts/agent.prompts.test.ts`.
- `src/prompts/slack-history.prompts.test.ts`.
- `src/prompts/skill-reflection.prompts.test.ts`.
- `src/shared/env.test.ts`.

## Implementation Workflow For Agents

Before editing:

1. Read the relevant module files.
2. Check existing ports and adapters.
3. Check tests for the behavior you are changing.
4. Check prompts only if model-facing behavior changes.
5. Inspect installed package types before using unfamiliar `@cloudflare/think`, `agents`, `ai`, Workers AI, Slack SDK, or Wrangler APIs.
6. Be aware the working tree may already contain user changes. Do not revert them.

When implementing a feature:

1. Define or update module/domain types.
2. Reuse or define ports.
3. Implement use case behavior.
4. Implement or update adapters.
5. Wire dependencies in the entrypoint.
6. Update prompts only when necessary.
7. Add focused tests.
8. Run relevant verification.
9. Update `README.md` and `AGENTS.md` when architecture, operations, commands, bindings, migrations, or workflows change.

When fixing a bug:

1. Reproduce or identify the failing behavior.
2. Add or update a regression test when practical.
3. Fix the smallest responsible module.
4. Avoid broad refactors.
5. Run targeted tests first, then broader verification when practical.

When changing docs:

- Keep repository docs in English.
- Keep docs accurate to current code and config.
- Mention commands the user can actually run.
- Do not document speculative architecture as implemented.
- If documenting future plans, label them clearly as plans.

## Code Style

Use TypeScript with strict, explicit types.

Prefer:

- Small use cases.
- Small pure functions.
- Constructor or factory dependency injection.
- Early returns.
- Clear typed inputs and outputs.
- Typed errors or result objects.
- Existing local helpers and patterns.
- Practical abstractions only when they remove real complexity.

Avoid:

- `any`.
- Hidden global mutable state.
- Large handlers.
- Large adapters with business logic.
- God classes.
- Deep nesting.
- Copy-paste validation.
- Direct SDK calls in use cases.
- Vendor-specific logic in domain behavior.
- New generic utility files for one-off logic.

Use `src/tools/` only for generic technical helpers that are reused and have no business meaning.

## Error Handling And Logging

Use typed errors or typed results. Do not throw raw strings.

Logging rules:

- Use `LoggerPort`.
- Do not scatter `console.log`.
- Direct console usage is acceptable only for very early bootstrap failures or temporary local debugging.
- Do not log secrets.
- Avoid logging full user messages unless explicitly needed and safe.
- Include operational metadata such as team id, channel id, event id, idempotency key, queue message id, or model name when useful.

External responses must not leak internal stack traces, tokens, or raw provider errors.

## Security Rules

Required security behavior:

- Validate all external input.
- Authenticate listener-to-Worker requests with `WORKER_INTERNAL_API_TOKEN`.
- Treat model-generated tool arguments as untrusted.
- Validate Think tool inputs.
- Never hardcode Slack tokens, Worker internal tokens, Cloudflare API keys, or other secrets.
- Never commit `.env`, `.dev.vars`, local state, or local database files.
- Never log full tokens.
- Keep Slack API calls behind Slack adapters.
- Keep Cloudflare binding access behind adapters and composition roots.

## Cloudflare And Wrangler Rules

Use Wrangler for Cloudflare Worker, D1, Queue, and deployment operations.

Before running Wrangler commands for unfamiliar operations, inspect current repo config and relevant docs or skills. For simple existing commands already documented in this repo, use the documented command.

Important commands:

```sh
npm run worker:dev
npm run worker:deploy
npx wrangler deploy --dry-run
npx wrangler d1 migrations apply slack-ai-agent-v3-history --local
npx wrangler d1 migrations apply slack-ai-agent-v3-history --remote
```

Do not change `wrangler.jsonc` casually. If changing bindings, queues, models, migrations, compatibility flags, or observability, update docs and run a dry run when practical.

## Planning Workflow

Use Plan Mode when the task is large, ambiguous, architectural, or has meaningful trade-offs.

When Plan Mode produces an approved final plan:

- Save it under `proto/features/`.
- Use the next sequential feature number.
- Use date format `YYYY-MM-DD`.
- Use a short lowercase kebab-case feature name.
- Preserve the complete final approved plan content.
- Translate the saved repository document to English.
- Do not summarize, shorten, omit, or rewrite substantive plan content except for required translation.
- Do not edit `.cursor/plans/*` unless explicitly instructed.

## Commit Workflow

Only commit when the user explicitly asks.

Use the local `gen-commits` skill when splitting uncommitted work into commits.

Commit subject format:

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

Commit body guidance:

- Explain purpose and important context.
- Keep logically separate changes in separate commits when practical.
- Do not commit `checkpoint.md`.
- Do not commit secrets.
- Do not commit `.env`, `.dev.vars`, local databases, `.wrangler/state`, `.DS_Store`, or generated local artifacts.
- Do not push unless the user explicitly asks.
- Do not use force operations unless the user explicitly asks and the risk is understood.
- After code/config commits, check whether `README.md` and `AGENTS.md` need updates and commit docs separately if they changed.

## Working Tree Safety

The working tree may be dirty.

Rules:

- Never revert changes you did not make unless explicitly requested.
- If unrelated files are modified, leave them alone.
- If a file you need to edit already has user changes, read it carefully and preserve those changes.
- Do not run destructive Git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Do not remove migrations that may have been applied.
- Do not delete `proto/features/` plan documents.
- Do not delete local state files unless the user explicitly asks.

## Cleanup Rules

Be conservative when deleting code.

Before removing a file, abstraction, migration, port, adapter, or prompt:

1. Search for imports.
2. Search for tests.
3. Search for config references.
4. Search `README.md`.
5. Search `AGENTS.md`.
6. Search `.cursor/rules/` when architecture or workflow is involved.

Do not remove future-facing architecture pieces if they are referenced by rules, docs, tests, or planned flows unless the user explicitly asks to simplify that area and the references are updated.

## Common Change Recipes

### Add A New Slack Event Behavior

1. Update normalization in `src/modules/slack-listener/slack-event-normalizer.ts` if raw Slack shape handling changes.
2. Update event decision logic in `src/modules/slack-listener/slack-event-filter.ts`.
3. Update listener orchestration only if Worker delivery or reply capture changes.
4. Update Worker validation if the request contract changes.
5. Update tests for normalizer, filter, listener use case, and Worker use case.
6. Confirm duplicate delivery behavior still does not double-invoke Think.

### Add A New Think Tool

1. Define or reuse a use case.
2. Define or reuse ports for external dependencies.
3. Validate model-generated tool input.
4. Add the tool in `src/modules/agent/agent.tools.ts`.
5. Add model-facing tool instructions in `src/prompts/agent-tools.prompts.ts` if needed.
6. Add tests for validation and behavior.
7. Ensure the tool does not directly access Slack SDK, D1, Workers AI, or Cloudflare bindings.

### Change Slack History Context

1. Update `SlackMessageHistoryPort` only if the query contract needs to change.
2. Update D1 and in-memory adapters together.
3. Update `BuildSlackHistoryContextUseCase`.
4. Update prompt formatting in `src/prompts/slack-history.prompts.ts` if output changes.
5. Update tests for use case, adapters, and prompts.

### Change Generated Skill Reflection

1. Update `GeneratedSkillBody` or generated skill contracts if the stored shape changes.
2. Update D1 and in-memory generated skill adapters together.
3. Update policy validation in `generated-skill-policy`.
4. Update reflection prompt only if the model-facing task changes.
5. Update reflection use case and job runner tests.
6. Add a D1 migration for schema changes.
7. Ensure runtime loading still filters `disabled = 0` and `is_old = 0`.

### Add A New Storage Backend

1. Reuse the existing port if possible.
2. Add the adapter under `src/adapters/storage/`.
3. Keep the use case unchanged.
4. Wire the adapter only in the composition root.
5. Add adapter tests.
6. Update docs if the backend becomes part of supported operation.

### Change Worker Configuration

1. Update `wrangler.jsonc`.
2. Update environment examples if needed.
3. Update `README.md` and this file.
4. Run `npx wrangler deploy --dry-run` when practical.
5. For D1 changes, add and validate migrations.

## Troubleshooting Notes

If local Worker reports missing D1 tables:

- Run `npx wrangler d1 migrations apply slack-ai-agent-v3-history --local`.
- Restart `npm run worker:dev`.
- Check that the local Wrangler instance is using the expected D1 database.

If Slack events reach the listener but not the Worker:

- Check `WORKER_SLACK_EVENT_URL`.
- Check `WORKER_INTERNAL_API_TOKEN`.
- Check that the URL path is `/slack/events`.
- Check `WorkerEventClientAdapter`.

If Slack events are captured but no assistant reply appears:

- Check whether `processingIntent` is `invoke`.
- In channels and MPIM, make sure the bot is mentioned.
- Check duplicate idempotency behavior.
- Check Worker logs around `HandleSlackMessageUseCase`.
- Check Think/model errors.

If generated skills are not being created:

- Check that the Worker enqueues reflection after successful replies.
- Check `SKILL_REFLECTION_QUEUE`.
- Check Queue consumer logs.
- Check `skill_reflection_jobs`.
- Check policy rejection reasons in logs.
- Check `REFLECTION_AI_MODEL`.

If generated skills are stored but not used:

- Check `disabled = 0`.
- Check `is_old = 0`.
- Check `createSlackAgentSkillSources()`.
- Check `SlackThinkAgent` skill loading.
- Check that the generated skill only declares allowed tools.

## Final Reminder

When uncertain, follow the existing code shape. Keep the listener thin, keep the Worker as the boundary, keep Think-specific code in the agent module or Think adapter, keep storage behind ports, keep prompts centralized, and keep tests focused on the behavior being changed.
