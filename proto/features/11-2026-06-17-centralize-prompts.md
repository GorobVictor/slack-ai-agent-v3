# Centralize Prompts In `src/prompts/`

## Current Prompt Map

Explicit prompt files found:

- `src/modules/agent/agent.prompts.ts` - `buildSlackAgentSystemPrompt()` is used in `src/modules/agent/think-agent.ts` through `getSystemPrompt()`.
- `src/modules/agent/skill-reflection.prompts.ts` - `buildSkillReflectionSystemPrompt()` and `buildSkillReflectionPrompt()` are used in `src/modules/agent/skill-reflection.use-case.ts` for `generateText()`.

Inline or concatenated model-facing text that should also be moved:

- `src/modules/agent/think-agent.ts` - `formatSlackUserMessage()` assembles Slack context plus `Message:` for the Think user message.
- `src/modules/agent/agent.tools.ts` - tool description, Zod `.describe()` strings, and tool fallback text for `getSlackHistoryContext`.
- `src/modules/agent/skill-reflection.use-case.ts` - `Output.object()` name/description and `formatExistingSkillsCatalog()`.
- `src/modules/slack/slack-history-summary.use-case.ts` - `No Slack history...` text and Slack history context formatting returned by the tool and read by the model.
- `src/modules/agent/generated-skill-body.ts` - generated skill body markdown renderer; this is runtime skill text later loaded by Think.
- `src/modules/agent/generated-skill-policy.ts` - fallback `description` phrase with `Use when...`, which duplicates the prompt/policy convention.

## Target Structure

Create one folder for all prompt TypeScript files:

```txt
src/prompts/
  agent.prompts.ts
  agent-tools.prompts.ts
  skill-reflection.prompts.ts
  slack-history.prompts.ts
  generated-skills.prompts.ts
```

Add a short English header comment to each file with usage locations, for example:

```ts
/**
 * Used by:
 * - src/modules/agent/think-agent.ts -> SlackThinkAgent.getSystemPrompt()
 * - src/modules/agent/think-agent.ts -> SlackThinkAgent.runSlackTurn()
 */
```

Keep file names as `*.prompts.ts` so searching for `prompts` quickly finds every file. Do not add a barrel `index.ts` in the first pass, so imports remain explicit and NodeNext `.js` suffixes stay clear.

## Change Plan

1. After the plan is approved, save it as a feature document in `proto/features/`:
   - use the next sequential index;
   - use the date `2026-06-17`;
   - use a short kebab-case name, for example `centralize-prompts`;
   - save the file in English according to the repository language policy.

2. Create `src/prompts/agent.prompts.ts`:
   - move `buildSlackAgentSystemPrompt()` from `src/modules/agent/agent.prompts.ts`;
   - extract `formatSlackUserMessage()` from `src/modules/agent/think-agent.ts` as `buildSlackUserMessagePrompt(input)` or a similar builder;
   - update the import in `src/modules/agent/think-agent.ts`.

3. Create `src/prompts/skill-reflection.prompts.ts`:
   - move `buildSkillReflectionSystemPrompt()` and `buildSkillReflectionPrompt()`;
   - extract `formatExistingSkillsCatalog()` as `buildExistingSkillsCatalogPrompt(skills)`;
   - extract the `SkillReflectionDecision` output name/description into constants used by `Output.object()`;
   - update imports in `src/modules/agent/skill-reflection.use-case.ts`.

4. Create `src/prompts/agent-tools.prompts.ts`:
   - extract the `getSlackHistoryContext` tool description;
   - extract Zod `.describe()` text for `scope`, `days`, and `threadTs`;
   - extract the tool fallback text `Slack history context is only available...`;
   - update `src/modules/agent/agent.tools.ts`, leaving schema/tool wiring and the use case call there.

5. Create `src/prompts/slack-history.prompts.ts`:
   - extract `No Slack history was captured...`;
   - extract the Slack history context formatter from `src/modules/slack/slack-history-summary.use-case.ts`, because it is tool output read by the model before summarization;
   - keep time-range and query logic in the Slack use case.

6. Create `src/prompts/generated-skills.prompts.ts`:
   - move only the model-facing markdown body renderer from `src/modules/agent/generated-skill-body.ts`, for example `renderGeneratedSkillBodyPrompt()`;
   - leave normalization and validation logic in the agent module, or rename locally without changing behavior;
   - extract the conventional fallback description text from `src/modules/agent/generated-skill-policy.ts` so `Use when...` is not duplicated between policy and reflection prompt.

7. Remove old prompt files after imports are updated:
   - delete `src/modules/agent/agent.prompts.ts`;
   - delete `src/modules/agent/skill-reflection.prompts.ts`;
   - if `src/modules/agent/agent-tool.prompts.ts` exists during implementation, include it in the migration instead of creating a duplicate.

8. Update documentation and rules that currently say prompts should live near the agent module:
   - `AGENTS.md` - replace the rule with `Prompts live in src/prompts/`;
   - `.cursor/rules/cloudflare-think-agent.mdc` - update folder structure examples and the Prompt Engineering section;
   - `README.md` - update only if implementation finds current references to old paths.

9. Update tests and add minimal regression coverage:
   - update imports in existing tests that touch `renderGeneratedSkillBody` or tool text;
   - add focused tests for the new prompt builders, especially `buildSkillReflectionPrompt()` and the Slack history formatter, to verify key sections and inputs are included;
   - avoid snapshotting every large prompt unless necessary, so tests do not become brittle.

10. Verify changes:
   - `npm run typecheck`;
   - `npm test`.

## Scope Boundaries

Move only text that the model receives as a prompt, tool description, structured output description, runtime context, or runtime skill text into `src/prompts/`. Do not move ordinary logs, developer/user-facing validation error messages, or test fixture descriptions unless they are passed to the model directly.

## Risks

- Current repository rules say prompts should live near the agent module, so documentation must be updated in the same refactor or future agents may restore the old structure.
- `skill-reflection` prompt and `generated-skill-policy` share rules (`kebab-case`, `Use when`, allowed tool `getSlackHistoryContext`); extract repeated prompt phrases/constants to reduce drift.
- The project uses `moduleResolution: NodeNext`, so all new imports need `.js` suffixes.
- `generated-skill-body.ts` mixes renderer and normalization; move only the model-facing renderer and keep validation/normalization in agent logic.
