# Think Worker Slack Replies

## Overview

Add a Cloudflare Worker powered by `@cloudflare/think` that receives normalized Slack events from the Node.js listener, runs a Think session or agent turn, and returns a JSON reply. The listener remains responsible for Slack Socket Mode and Slack Web API delivery, while the Worker owns HTTP routing, authentication, Slack session resolution, and Think orchestration.

## Target Flow

```txt
Slack
  -> Node.js Slack Listener
  -> Cloudflare Worker
  -> Slack Worker Use Case
  -> Think Session Port
  -> SlackThinkAgent Durable Object
  -> @cloudflare/think
  -> Cloudflare Worker JSON reply
  -> Node.js Slack Listener
  -> Slack chat.postMessage
```

## Implementation Steps

1. Move the shared Slack HTTP contract out of listener internals and add Worker reply response types.
2. Update the listener Worker client to parse reply responses and add a Slack messenger port for posting replies.
3. Add a Worker entrypoint, Slack HTTP handler, auth validation, session resolver, and Worker use case.
4. Add a Think session port and Think adapter that calls a named `SlackThinkAgent` Durable Object.
5. Implement `SlackThinkAgent extends Think<Env>` with Workers AI model wiring, a simple system prompt, and a public method for synchronous Slack turns.
6. Add Worker and Think dependencies, Wrangler configuration, Worker scripts, and TypeScript config separation if required.
7. Add focused tests for the listener reply flow, Worker handler/use case, session resolver, and Worker client response parsing.
8. Update repository docs with Worker environment, local commands, reply contract, and verification steps.
9. Run typecheck, tests, and available Worker config validation.

## Constraints

- The listener must not import `@cloudflare/think`, Workers AI, or Cloudflare bindings.
- The Worker must not call Slack APIs or require the Slack bot token.
- Use cases must depend on ports, not SDKs or concrete bindings.
- `@cloudflare/think` imports should stay in Think-specific agent or adapter files.
- Logs must not include secrets or full Slack message text by default.

## Risks

- The first version uses synchronous HTTP replies, which can be slow for long Think turns. If this becomes unreliable, move to `submitMessages()` plus an async delivery path.
- `@cloudflare/think` is preview/experimental, so the implementation must inspect installed package types instead of assuming undocumented APIs.
- Worker-side idempotency must avoid duplicate Think turns and duplicate Slack replies when the listener retries requests.
