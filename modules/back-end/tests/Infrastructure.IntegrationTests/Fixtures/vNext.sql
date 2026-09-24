\connect featbit

-- https://github.com/featbit/featbit/pull/1005
-- Mirrors infra/postgresql/docker-entrypoint-initdb.d/v6.0.1-PR1005-patch.sql for runners that only
-- load vX.Y.Z.sql release scripts plus this file (e.g. modules/front-end/scripts/run-e2e-containers.mjs).
-- Idempotent, so running it after the patch script is harmless. Empty this with the next release script.
ALTER TABLE feature_flags
    ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true;
