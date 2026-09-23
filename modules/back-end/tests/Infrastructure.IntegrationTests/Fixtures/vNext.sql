\connect featbit

-- Per-flag insights toggle. Existing flags keep collecting insights (default true).
ALTER TABLE feature_flags
    ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true;
