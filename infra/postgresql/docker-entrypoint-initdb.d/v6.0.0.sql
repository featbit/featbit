\connect featbit

-- https://github.com/featbit/featbit/pull/977

-- W3C trace context for the Postgres message queue.
--
-- Kafka carries `traceparent`/`tracestate` in message headers, so a flag change is one trace
-- from the API through to the evaluation server. The Postgres transport has no header concept,
-- so the same two values are carried as columns on the queue row instead.
--
-- Both are nullable and neither is read by any handler, which is what makes this safe to apply
-- in either order relative to a rolling upgrade:
--   * rows written by an older producer leave them NULL, and a NULL trace context is treated as
--     "no parent" by the consumer -- exactly the behavior before trace context existed;
--   * an older consumer simply never selects them.
--
-- NOTE FOR OPERATORS: scripts in docker-entrypoint-initdb.d only run when the Postgres data
-- directory is empty, i.e. on a brand new deployment. An existing database must have this
-- applied manually, and it must be applied BEFORE the new application image is rolled out.
-- Running new code against an old schema was tested deliberately, and it fails as follows:
--   * the API still returns HTTP 200 and still persists the flag change, because a failed
--     publish is swallowed and logged rather than thrown -- so the caller is told it worked;
--   * nothing is enqueued, so flag propagation stops entirely;
--   * the producer emits a single "Exception occurred while publishing message." line, but the
--     CONSUMER is far louder -- it retries in a loop, emitting
--     "Exception occurred while consuming topic ... will retry" carrying
--     '42703: column qm.trace_parent does not exist' every few seconds. In practice that retry
--     loop, not the single producer line, is what an operator notices first.
-- IF NOT EXISTS because an operator applying this by hand has no migration bookkeeping to tell
-- them whether they already have, so re-running it must be harmless. Re-running emits
-- 'NOTICE: column "trace_parent" of relation "queue_messages" already exists, skipping'.
ALTER TABLE queue_messages
    ADD COLUMN IF NOT EXISTS trace_parent text,
    ADD COLUMN IF NOT EXISTS trace_state  text;

COMMENT ON COLUMN queue_messages.trace_parent IS
    'W3C traceparent of the activity that published this message, or NULL if it was published before trace context existed or with no active activity. Read by the consumer to parent the consume span; never read by a handler.';

COMMENT ON COLUMN queue_messages.trace_state IS
    'W3C tracestate accompanying trace_parent, carrying vendor-specific trace data. Usually NULL.';
