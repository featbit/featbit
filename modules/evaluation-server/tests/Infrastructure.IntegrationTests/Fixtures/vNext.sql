\connect featbit

-- https://github.com/featbit/featbit/pull/1005
-- Per-flag insights toggle. Existing flags keep collecting insights (default true).
ALTER TABLE feature_flags
    ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true;