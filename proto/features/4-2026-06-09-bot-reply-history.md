# Bot Reply History

## Overview

Capture bot replies in the same D1 Slack history pipeline as user messages so summaries can use the full visible conversation context.

## Behavior

After the Worker returns a reply, the Node.js listener posts it to Slack with `chat.postMessage`. The Slack API response includes the posted message timestamp. The listener then sends a capture-only `SlackWorkerRequest` back to the Worker with the bot reply text and Slack timestamp.

```txt
User message -> Listener -> Worker -> D1 user message
Worker reply -> Listener -> Slack post -> Worker capture -> D1 bot message
```

## Notes

- Bot reply capture only happens after Slack accepts the message and returns a timestamp.
- Bot reply capture uses `processingIntent: "capture"` and does not invoke Think.
- This is not a backfill. Replies sent before this change are not captured automatically.
