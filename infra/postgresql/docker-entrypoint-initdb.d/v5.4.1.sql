\connect featbit

-- https://github.com/featbit/featbit/pull/915
CREATE INDEX ix_end_users_env_id_updated_at_id
    ON end_users (env_id, updated_at DESC, id DESC);

DROP INDEX IF EXISTS ix_end_users_workspace_id;
CREATE INDEX ix_end_users_workspace_id_updated_at_id
    ON end_users (workspace_id, updated_at DESC, id DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX gin_end_users_key_id_trgm
    ON end_users USING gin (key_id gin_trgm_ops);

CREATE INDEX gin_end_users_name_trgm
    ON end_users USING gin (name gin_trgm_ops);

-- https://github.com/featbit/featbit/pull/917

-- Expand audit_logs.keyword from varchar(128) to varchar(512).
-- The keyword is a comma-joined concatenation of a flag/segment key and name,
-- each of which can be up to 128 characters (128 + "," + 128 = 257).
ALTER TABLE audit_logs
    ALTER COLUMN keyword TYPE character varying(512);