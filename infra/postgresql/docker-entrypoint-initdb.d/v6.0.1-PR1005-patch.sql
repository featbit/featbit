\connect featbit

-- https://github.com/featbit/featbit/pull/1005
-- Temporary name: to be folded into the next release script, following the v6.0.0 convention (#978).
-- Per-flag insights toggle. Existing flags keep collecting insights (default true).
ALTER TABLE feature_flags
    ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true;
