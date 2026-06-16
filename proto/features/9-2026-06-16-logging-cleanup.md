# Logging Cleanup

## Overview

Improve console logging readability and reduce the risk of exposing full Slack payloads in local output. The implementation keeps the existing `LoggerPort` boundary and focuses on the console logger, Slack Socket Mode event boundary, and regression tests.

## Goals

- Replace raw JSON log lines with human-readable console output.
- Preserve structured metadata at call sites while rendering it as compact `key=value` pairs in the console.
- Avoid logging or passing full Slack `body` payloads beyond the Socket Mode adapter boundary.
- Keep Slack message processing, Worker forwarding, and D1 history behavior unchanged.

## Implementation

Update `src/adapters/logger/console-logger.adapter.ts`:

- Prefix each log line with an ISO timestamp and uppercase log level.
- Render metadata as compact `key=value` pairs.
- Omit `undefined` metadata values.
- Safely format primitive values, `Error` instances, objects, and arrays.
- Truncate large metadata values so accidental payloads do not flood the console.

Update `src/adapters/slack/slack-socket-mode.adapter.ts`:

- Sanitize Slack raw envelopes before dispatching them to listener use cases.
- Keep only the `body` fields needed by `normalizeSlackMessageEvent`: `team_id`, `event_id`, and `event_time`.
- Continue passing the Slack `event` object because the normalizer needs message fields from it.
- Do not pass Slack verification tokens, authorizations, duplicated event bodies, or other full `body` fields downstream.

Review existing log metadata in:

- `src/modules/slack-listener/slack-listener.use-case.ts`
- `src/modules/slack/handle-slack-message.use-case.ts`
- `src/modules/slack/slack.handler.ts`

Keep logs limited to safe operational metadata such as team, channel, thread, message IDs, event ID, channel type, intent, status, and reason. Do not log message text, Slack raw bodies, authorization headers, tokens, or full request payloads.

## Tests And Verification

Add focused tests for `ConsoleLoggerAdapter`:

- Human-readable log format.
- Metadata rendered as `key=value`.
- No raw JSON object as the primary console format.
- `undefined` metadata omitted.
- Large metadata values truncated.
- Correct routing to `console.info`, `console.warn`, and `console.error`.

Add focused tests for Slack envelope sanitization:

- Full Slack `body` fields are removed before downstream handling.
- Required body fields remain available for normalization.
- Normalized events still include team ID, event ID, event timestamp, channel ID, and message timestamp.

Run:

```sh
npm run typecheck
npm test
```
