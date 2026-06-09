\connect featbit

-- Expand audit_logs.keyword from varchar(128) to varchar(512).
-- The keyword is a comma-joined concatenation of a flag/segment key and name,
-- each of which can be up to 128 characters (128 + "," + 128 = 257).
-- The previous 128-character limit caused the cache-update notification to be
-- skipped (because the audit-log INSERT threw before the Redis upsert ran),
-- leaving flags with long keys invisible to the evaluation server.
ALTER TABLE audit_logs
    ALTER COLUMN keyword TYPE character varying(512);
