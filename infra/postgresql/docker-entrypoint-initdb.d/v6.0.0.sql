\connect featbit

-- Remove release-decision-web legacy features that are not part of the
-- FeatBit API-backed release-decision workflow.
DROP TABLE IF EXISTS user_project_memory;
DROP TABLE IF EXISTS project_memory;
DROP TABLE IF EXISTS agent_token;
DROP TABLE IF EXISTS auth_session;
DROP TABLE IF EXISTS customer_endpoint_provider;
DROP TABLE IF EXISTS managed_agent;
DROP TABLE IF EXISTS vault;
DROP TABLE IF EXISTS release_decision_messages;

-- Release decision experiment workspace.
-- This table intentionally does not reuse the existing experiments table:
-- existing experiments are FeatBit's native A/B testing model, while release
-- decision experiments mirror the release-decision-agent experiment records.
CREATE TABLE IF NOT EXISTS release_decision_experiments
(
    id                   uuid primary key                  default gen_random_uuid(),
    name                 varchar(256)             not null,
    description          text                     null,
    stage                varchar(64)              not null default 'hypothesis',
    flag_key             varchar(256)             null,
    featbit_project_key  varchar(256)             null,
    featbit_env_id       uuid                     null,
    hypothesis           text                     null,
    access_token         text                     null,
    change               text                     null,
    constraints          text                     null,
    env_secret           text                     null,
    flag_server_url      text                     null,
    goal                 text                     null,
    guardrails           text                     null,
    intent               text                     null,
    last_action          text                     null,
    last_learning        text                     null,
    open_questions       text                     null,
    primary_metric       text                     null,
    sandbox_id           text                     null,
    sandbox_status       varchar(64)              null default 'idle',
    variants             text                     null,
    conflict_analysis    text                     null,
    entry_mode           varchar(64)              null,
    created_at           timestamp with time zone not null default now(),
    updated_at           timestamp with time zone not null default now()
);

CREATE INDEX IF NOT EXISTS ix_release_decision_experiments_env_updated_at
    ON release_decision_experiments (featbit_env_id, updated_at);

CREATE INDEX IF NOT EXISTS ix_release_decision_experiments_project_key
    ON release_decision_experiments (featbit_project_key);

CREATE INDEX IF NOT EXISTS ix_release_decision_experiments_flag_key
    ON release_decision_experiments (flag_key);

CREATE INDEX IF NOT EXISTS ix_release_decision_experiments_env_flag_key
    ON release_decision_experiments (featbit_env_id, flag_key);

CREATE TABLE IF NOT EXISTS release_decision_activities
(
    id             uuid primary key                  default gen_random_uuid(),
    type           varchar(128)             not null,
    title          varchar(512)             not null,
    detail         text                     null,
    actor_id       uuid                     null,
    actor_name     varchar(256)             null,
    actor_email    varchar(512)             null,
    actor_type     varchar(64)              null,
    experiment_id  uuid                     not null,
    created_at     timestamp with time zone not null default now()
);

CREATE INDEX IF NOT EXISTS ix_release_decision_activities_experiment_created_at
    ON release_decision_activities (experiment_id, created_at);

ALTER TABLE release_decision_activities
    ADD COLUMN IF NOT EXISTS actor_id uuid null,
    ADD COLUMN IF NOT EXISTS actor_name varchar(256) null,
    ADD COLUMN IF NOT EXISTS actor_email varchar(512) null,
    ADD COLUMN IF NOT EXISTS actor_type varchar(64) null;

CREATE TABLE IF NOT EXISTS release_decision_experiment_runs
(
    id                       uuid primary key                  default gen_random_uuid(),
    experiment_id            uuid                     not null,
    slug                     varchar(128)             not null,
    status                   varchar(64)              not null default 'draft',
    hypothesis               text                     null,
    method                   varchar(64)              null,
    method_reason            text                     null,
    primary_metric_event     varchar(256)             null,
    metric_description       text                     null,
    guardrail_events         text                     null,
    guardrail_descriptions   text                     null,
    control_variant          varchar(256)             null,
    treatment_variant        varchar(256)             null,
    traffic_allocation       text                     null,
    minimum_sample           integer                  null,
    observation_start        timestamp with time zone null,
    observation_end          timestamp with time zone null,
    prior_proper             boolean                  not null default false,
    prior_mean               double precision         null,
    prior_stddev             double precision         null,
    input_data               text                     null,
    analysis_result          text                     null,
    decision                 text                     null,
    decision_summary         text                     null,
    decision_reason          text                     null,
    what_changed             text                     null,
    what_happened            text                     null,
    confirmed_or_refuted     text                     null,
    why_it_happened          text                     null,
    next_hypothesis          text                     null,
    run_id                   varchar(128)             null,
    primary_metric_agg       varchar(64)              null default 'once',
    primary_metric_type      varchar(64)              null default 'binary',
    traffic_percent          double precision         null default 100,
    layer_id                 varchar(128)             null,
    audience_filters         text                     null,
    traffic_offset           integer                  null default 0,
    layer_key                varchar(128)             null,
    allocation_key_selector  varchar(256)             null default 'user.keyId',
    slice_start              double precision         null default 0,
    slice_end                double precision         null default 100,
    allocation_plan          text                     null,
    assignment_unit_selector varchar(256)             null default 'user.keyId',
    layer_traffic_percent    double precision         null default 100,
    analysis_sampling_plan   text                     null,
    data_source_mode         varchar(64)              null default 'featbit-managed',
    customer_endpoint_config text                     null,
    created_at               timestamp with time zone not null default now(),
    updated_at               timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_release_decision_experiment_runs_experiment_slug
    ON release_decision_experiment_runs (experiment_id, slug);

ALTER TABLE release_decision_experiment_runs
    ADD COLUMN IF NOT EXISTS layer_key varchar(128) null,
    ADD COLUMN IF NOT EXISTS allocation_key_selector varchar(256) null default 'user.keyId',
    ADD COLUMN IF NOT EXISTS slice_start double precision null default 0,
    ADD COLUMN IF NOT EXISTS slice_end double precision null default 100,
    ADD COLUMN IF NOT EXISTS allocation_plan text null,
    ADD COLUMN IF NOT EXISTS assignment_unit_selector varchar(256) null default 'user.keyId',
    ADD COLUMN IF NOT EXISTS layer_traffic_percent double precision null default 100,
    ADD COLUMN IF NOT EXISTS analysis_sampling_plan text null;

CREATE TABLE IF NOT EXISTS release_decision_run_assignments
(
    id                    uuid primary key                  default gen_random_uuid(),
    run_id                uuid                     not null,
    env_id                uuid                     not null,
    flag_key              varchar(256)             not null,
    allocation_key        varchar(512)             not null,
    assignment_unit       varchar(512)             not null,
    user_key              varchar(512)             not null,
    expected_variation_id varchar(256)             null,
    actual_variation_id   varchar(256)             null,
    role                  varchar(64)              not null,
    analysis_role         varchar(64)              not null default 'treatment',
    bucket                double precision         not null,
    layer_bucket          double precision         null,
    sampling_bucket       double precision         null,
    included_by_sampling  boolean                  not null default true,
    exclusion_reason      varchar(64)              null,
    assigned_at           timestamp with time zone not null,
    first_exposed_at      timestamp with time zone not null,
    created_at            timestamp with time zone not null default now(),
    updated_at            timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_release_decision_run_assignments_run_allocation
    ON release_decision_run_assignments (run_id, allocation_key);

CREATE INDEX IF NOT EXISTS ix_release_decision_run_assignments_run_role
    ON release_decision_run_assignments (run_id, role);

ALTER TABLE release_decision_run_assignments
    ADD COLUMN IF NOT EXISTS assignment_unit varchar(512) null,
    ADD COLUMN IF NOT EXISTS analysis_role varchar(64) null default 'treatment',
    ADD COLUMN IF NOT EXISTS layer_bucket double precision null,
    ADD COLUMN IF NOT EXISTS sampling_bucket double precision null,
    ADD COLUMN IF NOT EXISTS included_by_sampling boolean not null default true,
    ADD COLUMN IF NOT EXISTS exclusion_reason varchar(64) null;

UPDATE release_decision_run_assignments
SET assignment_unit = allocation_key
WHERE assignment_unit IS NULL;

UPDATE release_decision_run_assignments
SET analysis_role = role
WHERE analysis_role IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_release_decision_run_assignments_run_assignment_unit
    ON release_decision_run_assignments (run_id, assignment_unit);

CREATE INDEX IF NOT EXISTS ix_release_decision_run_assignments_run_analysis_role
    ON release_decision_run_assignments (run_id, analysis_role);

-- Release-decision evidence is intentionally stored separately from both the
-- legacy events table and the release-decision experiment/run tables. These
-- tables are shared raw events; analysis joins them to a run by flag, metric,
-- and observation window instead of binding events to a run at ingestion time.
CREATE TABLE IF NOT EXISTS release_decision_exposure_events
(
    id              uuid primary key                  default gen_random_uuid(),
    env_id          uuid                     not null,
    flag_key        varchar(256)             not null,
    user_key        varchar(512)             not null,
    variation_id    varchar(256)             not null,
    variation_value varchar(512)             null,
    exposed_at      timestamp with time zone not null,
    properties      jsonb                    null,
    created_at      timestamp with time zone not null default now()
);

CREATE INDEX IF NOT EXISTS ix_release_decision_exposures_env_flag_time
    ON release_decision_exposure_events (env_id, flag_key, exposed_at);

CREATE INDEX IF NOT EXISTS ix_release_decision_exposures_env_user_time
    ON release_decision_exposure_events (env_id, user_key, exposed_at);

CREATE TABLE IF NOT EXISTS release_decision_metric_events
(
    id            uuid primary key                  default gen_random_uuid(),
    env_id        uuid                     not null,
    user_key      varchar(512)             not null,
    event_name    varchar(256)             not null,
    event_type    varchar(64)              not null default 'CustomEvent',
    numeric_value double precision         not null default 1,
    occurred_at   timestamp with time zone not null,
    properties    jsonb                    null,
    created_at    timestamp with time zone not null default now()
);

CREATE INDEX IF NOT EXISTS ix_release_decision_metrics_env_event_time
    ON release_decision_metric_events (env_id, event_name, occurred_at);

CREATE INDEX IF NOT EXISTS ix_release_decision_metrics_env_event_user_time
    ON release_decision_metric_events (env_id, event_name, user_key, occurred_at);

-- Optional rollup cache for heavy dashboards, bandit reweighting jobs, or
-- repeated analyses. It is not the source of truth.
CREATE TABLE IF NOT EXISTS release_decision_run_variant_stats
(
    id            uuid primary key                  default gen_random_uuid(),
    env_id        uuid                     not null,
    experiment_id uuid                     null,
    run_id        uuid                     not null,
    metric_event  varchar(256)             not null,
    metric_type   varchar(64)              not null,
    metric_agg    varchar(64)              not null,
    variation     varchar(512)             not null,
    users         bigint                   not null,
    conversions   bigint                   not null,
    sum_value     double precision         not null,
    sum_squares   double precision         not null,
    window_start  timestamp with time zone not null,
    window_end    timestamp with time zone not null,
    computed_at   timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_release_decision_run_variant_stats_window
    ON release_decision_run_variant_stats
       (run_id, metric_event, metric_type, metric_agg, variation, window_start, window_end);

CREATE TABLE IF NOT EXISTS mcp_device_authorizations
(
    id                       uuid primary key,
    client_id                varchar(256) not null,
    device_code_hash         varchar(64)  not null,
    user_code                varchar(16)  not null,
    env_id                   uuid         not null,
    experiment_id            uuid         null,
    expires_at               timestamp with time zone not null,
    is_approved              boolean      not null default false,
    approved_user_id         uuid         null,
    approved_organization_id uuid         null,
    approved_workspace_id    uuid         null,
    created_at               timestamp with time zone not null default now(),
    updated_at               timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_device_authorizations_device_code_hash
    ON mcp_device_authorizations (device_code_hash);

CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_device_authorizations_user_code
    ON mcp_device_authorizations (user_code);

CREATE INDEX IF NOT EXISTS ix_mcp_device_authorizations_expires_at
    ON mcp_device_authorizations (expires_at);

CREATE TABLE IF NOT EXISTS mcp_refresh_authorizations
(
    id              uuid primary key,
    token_hash      varchar(64)  not null,
    client_id       varchar(256) not null,
    user_id         uuid         not null,
    organization_id uuid         not null,
    workspace_id    uuid         not null,
    env_id          uuid         not null,
    experiment_id   uuid         null,
    expires_at      timestamp with time zone not null,
    created_at      timestamp with time zone not null default now(),
    updated_at      timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_refresh_authorizations_token_hash
    ON mcp_refresh_authorizations (token_hash);

CREATE INDEX IF NOT EXISTS ix_mcp_refresh_authorizations_expires_at
    ON mcp_refresh_authorizations (expires_at);

CREATE TABLE IF NOT EXISTS mcp_access_token_sessions
(
    id              uuid primary key,
    token_id        varchar(128) not null,
    client_id       varchar(256) not null,
    user_id         uuid         not null,
    organization_id uuid         not null,
    workspace_id    uuid         not null,
    expires_at      timestamp with time zone not null,
    revoked_at      timestamp with time zone null,
    created_at      timestamp with time zone not null default now(),
    updated_at      timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_token_id
    ON mcp_access_token_sessions (token_id);

CREATE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_expires_at
    ON mcp_access_token_sessions (expires_at);

CREATE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_revoked_at
    ON mcp_access_token_sessions (revoked_at);
