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

CREATE INDEX idx_events_distinct_id ON events (distinct_id);
CREATE INDEX idx_events_env_id ON events (env_id);
CREATE INDEX idx_events_event ON events (event);
CREATE INDEX idx_events_timestamp ON events (timestamp);
"""