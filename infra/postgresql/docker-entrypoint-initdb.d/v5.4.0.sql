\connect featbit

-- https://github.com/featbit/featbit/pull/885

-- Replace the legacy 'ManageSegment' action with the wildcard '*' in all policy statements.
-- This normalizes existing action names after the segment permission model was broadened.
UPDATE policies
SET statements = (
    SELECT jsonb_agg(
                   jsonb_set(
                           elem,
                           '{actions}',
                           (
                               SELECT jsonb_agg(
                                              CASE
                                                  WHEN action = '"ManageSegment"'::jsonb THEN '"*"'::jsonb
                                                  ELSE action
                                                  END
                                      )
                               FROM jsonb_array_elements(elem->'actions') AS action
                           )
                   )
           )
    FROM jsonb_array_elements(statements) AS elem
)
WHERE statements IS NOT NULL;

-- Append a new 'allow all' statement for the segment resource type to the built-in
-- admin and developer policies so they retain full segment access after the model change.
UPDATE policies
SET statements = statements || jsonb_build_array(
        jsonb_build_object(
                'id', gen_random_uuid(),
                'effect', 'allow',
                'actions', jsonb_build_array('*'),
                'resources', jsonb_build_array('project/*:env/*:segment/*'),
                'resourceType', 'segment'
        )
                               )
WHERE id IN (
             '3e961f0f-6fd4-4cf4-910f-52d356f8cc08', -- admin
             '66f3687f-939d-4257-bd3f-c3553d39e1b6' -- developer
    );

-- Mirror the same 'ManageSegment' -> '*' action migration for access token permissions.
UPDATE access_tokens
SET
    permissions = (
        SELECT COALESCE(
                       jsonb_agg(
                               jsonb_set(
                                       elem,
                                       '{actions}',
                                       (
                                           SELECT COALESCE(
                                                          jsonb_agg(
                                                                  CASE
                                                                      WHEN action = '"ManageSegment"'::jsonb THEN '"*"'::jsonb
                                                                      ELSE action
                                                                      END
                                                          ),
                                                          '[]'::jsonb
                                                  )
                                           FROM jsonb_array_elements(elem->'actions') AS action
                                       )
                               )
                       ),
                       '[]'::jsonb
               )
        FROM jsonb_array_elements(permissions) AS elem
    )
WHERE permissions IS NOT NULL;    
    

-- https://github.com/featbit/featbit/pull/888

-- Monthly unique end users per environment
-- One row per (env_id, year_month, user_key); first_seen_at is written once on insert and never updated.
-- Equivalent of Redis ZADD NX: only the first occurrence in a month is recorded.
--
-- Queries this enables:
--   MAU / DAU  : SELECT COUNT(*) FROM usage_end_user_stats WHERE env_id = ANY(?) AND first_seen_at BETWEEN ? AND ?
--   Daily trend: ... GROUP BY first_seen_at
--   Per-env    : ... GROUP BY env_id
CREATE TABLE usage_end_user_stats
(
    env_id        uuid                     NOT NULL,
    year_month    integer                  NOT NULL, -- format YYYYMM, e.g. 202604
    user_key      varchar(512)             NOT NULL,
    first_seen_at date                     NOT NULL,
    CONSTRAINT pk_usage_end_user_stats PRIMARY KEY (env_id, year_month, user_key)
);

-- All read queries filter on (env_id, first_seen_at); year_month only appears in the PK for upsert deduplication.
CREATE INDEX ix_usage_end_user_stats_env_date ON usage_end_user_stats (env_id, first_seen_at);

-- Daily aggregated metrics per environment
-- Tracks total flag_evaluations and custom_metrics per day
-- Upsert with increment so multiple writes on the same day accumulate correctly
CREATE TABLE usage_event_stats
(
    env_id           uuid   NOT NULL,
    stats_date       date   NOT NULL,
    flag_evaluations integer NOT NULL DEFAULT 0,
    custom_metrics   integer NOT NULL DEFAULT 0,
    CONSTRAINT pk_usage_event_stats PRIMARY KEY (env_id, stats_date)
);