\connect featbit

-- Control plane data center membership leases (Option A consistency).
-- One row per data center, keyed by dc_id. Mirrors the Mongo "dc_leases" collection.
CREATE TABLE IF NOT EXISTS dc_leases
(
    dc_id              text PRIMARY KEY,
    region             text,
    last_heartbeat_at  timestamptz,
    lease_expires_at   timestamptz,
    applied_watermarks jsonb
);

-- The live-set query filters on lease_expires_at > now().
CREATE INDEX IF NOT EXISTS ix_dc_leases_lease_expires_at
    ON dc_leases (lease_expires_at);

-- B4: committed-vs-pending for feature_flags (Postgres parity with the Mongo path).
-- committed_version: monotonic version of the last COMMITTED change (default 0).
-- pending: a staged-but-not-committed change, stored as jsonb (NULL when none).
ALTER TABLE feature_flags
    ADD COLUMN committed_version bigint NOT NULL DEFAULT 0,
    ADD COLUMN pending jsonb NULL;

-- S1: committed-vs-pending for segments (Postgres parity with the Mongo path).
-- committed_version: monotonic version of the last COMMITTED change (default 0).
-- pending: a staged-but-not-committed change, stored as jsonb (NULL when none).
ALTER TABLE segments
    ADD COLUMN committed_version bigint NOT NULL DEFAULT 0,
    ADD COLUMN pending jsonb NULL;
