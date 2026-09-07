\set ON_ERROR_STOP on
\connect featbit

-- Applied after the experiment schema for new Aspire volumes.
-- Existing volumes require this script to be applied once before rebuilding the API.
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS last_run_number bigint NULL;
