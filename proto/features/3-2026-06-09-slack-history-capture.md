# Slack History Capture

## Overview

Add passive Slack message history capture in D1 for bot-visible channels, threads, DMs, and MPIMs without changing the reply rule. The listener forwards all valid normalized Slack messages to the Worker. The Worker stores every message idempotently, but invokes the Think agent only for direct messages or explicit bot mentions.

## Target Behavior

```txt
Slack Events
  -> Node.js Slack Listener
  -> Cloudflare Worker
  -> Save message to D1
  -> Invoke Think only for DM or mention
  -> Return reply or no_reply
```

## Implementation Steps

1. Fix Slack `channel_type` to internal event kind mapping so `channel` maps to `message.channels` and `group` maps to `message.groups`.
2. Split listener handling into capture-only and invoke intents.
3. Extend the shared Slack HTTP contract with `processingIntent`.
4. Add a D1-backed Slack message history port and adapter.
5. Add D1 schema and Wrangler binding.
6. Update the Worker use case to save messages before optionally invoking Think.
7. Add history query APIs for channel, thread, and channel-with-threads time windows.
8. Add a Think summary tool that reads bounded Slack history from D1.
9. Update tests and docs.

## Notes

- This is not a backfill. Only messages visible to the bot while the listener is running are captured.
- Private channels require the bot to be a member.
- Message edits and deletes are still ignored in the first version.
- D1 stores message text and metadata. File bytes can be added later behind R2 if needed.
