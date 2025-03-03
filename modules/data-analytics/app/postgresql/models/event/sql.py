EVENTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS events
(
    id UUID PRIMARY KEY,
    distinct_id VARCHAR NOT NULL,
    env_id VARCHAR,
    event VARCHAR,
    properties JSONB,
    timestamp TIMESTAMP NOT NULL
);

CREATE INDEX idx_events_combined
ON events (distinct_id, event, env_id, timestamp);
"""