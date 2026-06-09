CREATE TABLE IF NOT EXISTS slack_messages (
  idempotency_key TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_ts TEXT NOT NULL,
  thread_ts TEXT,
  text TEXT NOT NULL,
  channel_type TEXT,
  is_mention INTEGER NOT NULL,
  is_thread_message INTEGER NOT NULL,
  processing_intent TEXT NOT NULL,
  event_id TEXT,
  event_ts TEXT,
  client_msg_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_slack_messages_channel_time
  ON slack_messages (team_id, channel_id, message_ts);

CREATE INDEX IF NOT EXISTS idx_slack_messages_thread_time
  ON slack_messages (team_id, channel_id, thread_ts, message_ts);
