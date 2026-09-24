\connect featbit

-- https://github.com/featbit/featbit/pull/940
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
    ADD COLUMN pending           jsonb  NULL;

-- S1: committed-vs-pending for segments (Postgres parity with the Mongo path).
-- committed_version: monotonic version of the last COMMITTED change (default 0).
-- pending: a staged-but-not-committed change, stored as jsonb (NULL when none).
ALTER TABLE segments
    ADD COLUMN committed_version bigint NOT NULL DEFAULT 0,
    ADD COLUMN pending           jsonb  NULL;

-- https://github.com/featbit/featbit/pull/921

-- Preserve legacy data without migrating it into the v6 schema. If migration is needed, contact FeatBit for data migration assistance.
ALTER TABLE IF EXISTS events RENAME TO events_legacy;
ALTER TABLE IF EXISTS events_legacy RENAME CONSTRAINT events_pkey TO events_pkey_legacy;
ALTER INDEX IF EXISTS idx_events_combined RENAME TO idx_events_combined_legacy;

ALTER TABLE IF EXISTS experiments RENAME TO experiments_legacy;
ALTER TABLE IF EXISTS experiments_legacy RENAME CONSTRAINT pk_experiments TO pk_experiments_legacy;
ALTER INDEX IF EXISTS ix_experiments_env_id_feature_flag_id RENAME TO ix_experiments_env_id_feature_flag_id_legacy;

ALTER TABLE IF EXISTS experiment_metrics RENAME TO experiment_metrics_legacy;
ALTER TABLE IF EXISTS experiment_metrics_legacy RENAME CONSTRAINT pk_experiment_metrics TO pk_experiment_metrics_legacy;
ALTER INDEX IF EXISTS ix_experiment_metrics_env_id RENAME TO ix_experiment_metrics_env_id_legacy;

-- New tables for experiment exposure events, layers, and metric events
CREATE TABLE IF NOT EXISTS experiment_exposure_events
(
    id              uuid                     NOT NULL,
    env_id          uuid                     NOT NULL,
    flag_key        character varying(256)   NOT NULL,
    user_key        character varying(512)   NOT NULL,
    variation_id    character varying(256)   NOT NULL,
    variation_value character varying(512),
    exposed_at      timestamp with time zone NOT NULL,
    created_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_exposure_events PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS experiment_layers
(
    id                       uuid                     NOT NULL,
    env_id                   uuid                     NOT NULL,
    name                     character varying(256)   NOT NULL,
    key                      character varying(128)   NOT NULL,
    description              text,
    assignment_unit_selector character varying(256),
    status                   character varying(64)    NOT NULL,
    created_at               timestamp with time zone NOT NULL,
    updated_at               timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_layers PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS experiment_metric_events
(
    id               uuid                     NOT NULL,
    env_id           uuid                     NOT NULL,
    user_key         character varying(512)   NOT NULL,
    event_name       character varying(256)   NOT NULL,
    event_type       character varying(64)    NOT NULL,
    numeric_value    double precision         NOT NULL,
    application_type character varying(128),
    occurred_at      timestamp with time zone NOT NULL,
    created_at       timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_metric_events PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS experiment_metrics
(
    id          uuid                     NOT NULL,
    env_id      uuid                     NOT NULL,
    name        character varying(256)   NOT NULL,
    key         character varying(128)   NOT NULL,
    event_name  varchar(256)             NOT NULL,
    description text,
    metric_type character varying(64)    NOT NULL,
    metric_agg  character varying(64)    NOT NULL,
    status      character varying(64)    NOT NULL,
    created_at  timestamp with time zone NOT NULL,
    updated_at  timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_metrics PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS experiment_run_assignments
(
    id                    uuid                     NOT NULL,
    run_id                uuid                     NOT NULL,
    env_id                uuid                     NOT NULL,
    flag_key              character varying(256)   NOT NULL,
    allocation_key        character varying(512)   NOT NULL,
    assignment_unit       character varying(512)   NOT NULL,
    user_key              character varying(512)   NOT NULL,
    expected_variation_id character varying(256),
    actual_variation_id   character varying(256),
    role                  character varying(64)    NOT NULL,
    analysis_role         character varying(64)    NOT NULL,
    bucket                double precision         NOT NULL,
    layer_bucket          double precision,
    sampling_bucket       double precision,
    included_by_sampling  boolean                  NOT NULL,
    exclusion_reason      character varying(64),
    assigned_at           timestamp with time zone NOT NULL,
    first_exposed_at      timestamp with time zone NOT NULL,
    created_at            timestamp with time zone NOT NULL,
    updated_at            timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_run_assignments PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS experiment_runs
(
    id                       uuid                     NOT NULL,
    experiment_id            uuid                     NOT NULL,
    slug                     character varying(128)   NOT NULL,
    method                   character varying(64),
    primary_metric           jsonb,
    guardrail_metrics        jsonb                    NOT NULL DEFAULT '[]'::jsonb,
    control_variant          character varying(256),
    treatment_variants       jsonb                    NOT NULL DEFAULT '[]'::jsonb,
    variations               jsonb                    NOT NULL DEFAULT '[]'::jsonb,
    minimum_sample           integer,
    observation_start        timestamp with time zone,
    observation_end          timestamp with time zone,
    prior_proper             boolean                  NOT NULL,
    prior_mean               double precision,
    prior_stddev             double precision,
    analysis_result          text,
    decision                 text,
    decision_summary         text,
    decision_reason          text,
    what_changed             text,
    what_happened            text,
    confirmed_or_refuted     text,
    why_it_happened          text,
    next_hypothesis          text,
    traffic_percent          double precision,
    layer_id                 uuid,
    traffic_offset           integer,
    layer_key                character varying(128),
    allocation_key_selector  character varying(256),
    slice_start              double precision,
    slice_end                double precision,
    allocation_plan          text,
    assignment_unit_selector character varying(256),
    layer_traffic_percent    double precision,
    analysis_sampling_plan   text,
    created_at               timestamp with time zone NOT NULL,
    updated_at               timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_runs PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS experiments
(
    id                uuid                     NOT NULL,
    name              character varying(256)   NOT NULL,
    description       text,
    stage             character varying(64)    NOT NULL,
    flag_id           uuid,
    env_id            uuid,
    hypothesis        text,
    change            text,
    constraints       text,
    goal              text,
    guardrail_metrics jsonb                    NOT NULL DEFAULT '[]'::jsonb,
    intent            text,
    last_action       text,
    last_learning     text,
    last_run_number   integer                  NOT NULL DEFAULT 0,
    primary_metric    jsonb,
    conflict_analysis text,
    created_at        timestamp with time zone NOT NULL,
    updated_at        timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiments PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS mcp_access_token_sessions
(
    id              uuid                     NOT NULL,
    token_id        character varying(128)   NOT NULL,
    client_id       character varying(256)   NOT NULL,
    user_id         uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    workspace_id    uuid                     NOT NULL,
    expires_at      timestamp with time zone NOT NULL,
    revoked_at      timestamp with time zone,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_mcp_access_token_sessions PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS mcp_device_authorizations
(
    id                       uuid                     NOT NULL,
    client_id                character varying(256)   NOT NULL,
    device_code_hash         character varying(64)    NOT NULL,
    user_code                character varying(16)    NOT NULL,
    env_id                   uuid                     NOT NULL,
    experiment_id            uuid,
    expires_at               timestamp with time zone NOT NULL,
    is_approved              boolean                  NOT NULL,
    approved_user_id         uuid,
    approved_organization_id uuid,
    approved_workspace_id    uuid,
    created_at               timestamp with time zone NOT NULL,
    updated_at               timestamp with time zone NOT NULL,
    CONSTRAINT pk_mcp_device_authorizations PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS mcp_refresh_authorizations
(
    id              uuid                     NOT NULL,
    token_hash      character varying(64)    NOT NULL,
    client_id       character varying(256)   NOT NULL,
    user_id         uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    workspace_id    uuid                     NOT NULL,
    env_id          uuid                     NOT NULL,
    experiment_id   uuid,
    expires_at      timestamp with time zone NOT NULL,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_mcp_refresh_authorizations PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_experiment_exposure_events_env_id_flag_key_exposed_at
    ON experiment_exposure_events (env_id, flag_key, exposed_at);
CREATE INDEX IF NOT EXISTS ix_experiment_metric_events_env_id_event_name_occurred_at
    ON experiment_metric_events (env_id, event_name, occurred_at);

CREATE INDEX IF NOT EXISTS ix_experiments_env_id_updated_at
    ON experiments (env_id, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_metrics_env_id_key
    ON experiment_metrics (env_id, key);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_layers_env_id_key
    ON experiment_layers (env_id, key);

CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_runs_experiment_id_slug
    ON experiment_runs (experiment_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_id_allocation_key
    ON experiment_run_assignments (run_id, allocation_key);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_id_assignment_unit
    ON experiment_run_assignments (run_id, assignment_unit);

CREATE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_expires_at
    ON mcp_access_token_sessions (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_token_id
    ON mcp_access_token_sessions (token_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_device_authorizations_device_code_hash
    ON mcp_device_authorizations (device_code_hash);
CREATE INDEX IF NOT EXISTS ix_mcp_device_authorizations_expires_at
    ON mcp_device_authorizations (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_device_authorizations_user_code
    ON mcp_device_authorizations (user_code);
CREATE INDEX IF NOT EXISTS ix_mcp_refresh_authorizations_expires_at
    ON mcp_refresh_authorizations (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_refresh_authorizations_token_hash
    ON mcp_refresh_authorizations (token_hash);

-- https://github.com/featbit/featbit/pull/977

-- W3C trace context for the Postgres message queue.
--
-- Kafka carries `traceparent`/`tracestate` in message headers, so a flag change is one trace
-- from the API through to the evaluation server. The Postgres transport has no header concept,
-- so the same two values are carried as columns on the queue row instead.
--
-- Both are nullable and neither is read by any handler, which is what makes this safe to apply
-- in either order relative to a rolling upgrade:
--   * rows written by an older producer leave them NULL, and a NULL trace context is treated as
--     "no parent" by the consumer -- exactly the behavior before trace context existed;
--   * an older consumer simply never selects them.
--
-- NOTE FOR OPERATORS: scripts in docker-entrypoint-initdb.d only run when the Postgres data
-- directory is empty, i.e. on a brand new deployment. An existing database must have this
-- applied manually, and it must be applied BEFORE the new application image is rolled out.
-- Running new code against an old schema was tested deliberately, and it fails as follows:
--   * the API still returns HTTP 200 and still persists the flag change, because a failed
--     publish is swallowed and logged rather than thrown -- so the caller is told it worked;
--   * nothing is enqueued, so flag propagation stops entirely;
--   * the producer emits a single "Exception occurred while publishing message." line, but the
--     CONSUMER is far louder -- it retries in a loop, emitting
--     "Exception occurred while consuming topic ... will retry" carrying
--     '42703: column qm.trace_parent does not exist' every few seconds. In practice that retry
--     loop, not the single producer line, is what an operator notices first.
-- IF NOT EXISTS because an operator applying this by hand has no migration bookkeeping to tell
-- them whether they already have, so re-running it must be harmless. Re-running emits
-- 'NOTICE: column "trace_parent" of relation "queue_messages" already exists, skipping'.
ALTER TABLE queue_messages
    ADD COLUMN IF NOT EXISTS trace_parent text,
    ADD COLUMN IF NOT EXISTS trace_state  text;

COMMENT ON COLUMN queue_messages.trace_parent IS
    'W3C traceparent of the activity that published this message, or NULL if it was published before trace context existed or with no active activity. Read by the consumer to parent the consume span; never read by a handler.';

COMMENT ON COLUMN queue_messages.trace_state IS
    'W3C tracestate accompanying trace_parent, carrying vendor-specific trace data. Usually NULL.';
