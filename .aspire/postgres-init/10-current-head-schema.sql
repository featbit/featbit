\set ON_ERROR_STOP on
\connect featbit

BEGIN;

-- The released migrations still contain the legacy experiment tables. Current
-- HEAD maps new shapes to the same names, so only replace empty legacy tables.
DO $guard$
DECLARE
    has_rows boolean;
BEGIN
    IF to_regclass('public.experiments') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'experiments'
             AND column_name IN ('env_id', 'metric_id', 'feature_flag_id'))
    THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.experiments)' INTO has_rows;
        IF has_rows THEN
            RAISE EXCEPTION 'Refusing to replace non-empty legacy public.experiments';
        END IF;
        EXECUTE 'DROP TABLE public.experiments';
    END IF;

    IF to_regclass('public.experiment_metrics') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'experiment_metrics'
             AND column_name IN ('env_id', 'maintainer_user_id', 'event_name'))
    THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.experiment_metrics)' INTO has_rows;
        IF has_rows THEN
            RAISE EXCEPTION 'Refusing to replace non-empty legacy public.experiment_metrics';
        END IF;
        EXECUTE 'DROP TABLE public.experiment_metrics';
    END IF;
END
$guard$;

CREATE TABLE IF NOT EXISTS public.experiment_activities (
    id uuid NOT NULL,
    type character varying(128) NOT NULL,
    title character varying(512) NOT NULL,
    detail text,
    actor_id uuid,
    actor_name character varying(256),
    actor_email character varying(512),
    actor_type character varying(64),
    created_at timestamp with time zone NOT NULL,
    experiment_id uuid NOT NULL,
    CONSTRAINT pk_experiment_activities PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.experiment_exposure_events (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    flag_key character varying(256) NOT NULL,
    user_key character varying(512) NOT NULL,
    variation_id character varying(256) NOT NULL,
    variation_value character varying(512),
    exposed_at timestamp with time zone NOT NULL,
    properties jsonb,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_exposure_events PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.experiment_layers (
    id uuid NOT NULL,
    featbit_env_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    key character varying(128) NOT NULL,
    description text,
    assignment_unit_selector character varying(256),
    status character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_layers PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.experiment_metric_events (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    user_key character varying(512) NOT NULL,
    event_name character varying(256) NOT NULL,
    event_type character varying(64) NOT NULL,
    numeric_value double precision NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    properties jsonb,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_metric_events PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.experiment_metrics (
    id uuid NOT NULL,
    featbit_env_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    key character varying(128) NOT NULL,
    description text,
    metric_type character varying(64) NOT NULL,
    metric_agg character varying(64) NOT NULL,
    expected_direction character varying(64) NOT NULL,
    status character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_metrics PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.experiment_run_assignments (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    env_id uuid NOT NULL,
    flag_key character varying(256) NOT NULL,
    allocation_key character varying(512) NOT NULL,
    assignment_unit character varying(512) NOT NULL,
    user_key character varying(512) NOT NULL,
    expected_variation_id character varying(256),
    actual_variation_id character varying(256),
    role character varying(64) NOT NULL,
    analysis_role character varying(64) NOT NULL,
    bucket double precision NOT NULL,
    layer_bucket double precision,
    sampling_bucket double precision,
    included_by_sampling boolean NOT NULL,
    exclusion_reason character varying(64),
    assigned_at timestamp with time zone NOT NULL,
    first_exposed_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_run_assignments PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.experiment_runs (
    id uuid NOT NULL,
    experiment_id uuid NOT NULL,
    slug character varying(128) NOT NULL,
    status character varying(64) NOT NULL,
    hypothesis text,
    method character varying(64),
    method_reason text,
    primary_metric_event character varying(256),
    metric_description text,
    guardrail_events text,
    guardrail_descriptions text,
    control_variant character varying(256),
    treatment_variant character varying(256),
    traffic_allocation text,
    minimum_sample integer,
    observation_start timestamp with time zone,
    observation_end timestamp with time zone,
    prior_proper boolean NOT NULL,
    prior_mean double precision,
    prior_stddev double precision,
    input_data text,
    analysis_result text,
    decision text,
    decision_summary text,
    decision_reason text,
    what_changed text,
    what_happened text,
    confirmed_or_refuted text,
    why_it_happened text,
    next_hypothesis text,
    primary_metric_agg character varying(64),
    primary_metric_type character varying(64),
    traffic_percent double precision,
    layer_id uuid,
    audience_filters text,
    traffic_offset integer,
    layer_key character varying(128),
    allocation_key_selector character varying(256),
    slice_start double precision,
    slice_end double precision,
    allocation_plan text,
    assignment_unit_selector character varying(256),
    layer_traffic_percent double precision,
    analysis_sampling_plan text,
    data_source_mode character varying(64),
    customer_endpoint_config text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_runs PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.experiments (
    id uuid NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    stage character varying(64) NOT NULL,
    flag_key character varying(256),
    featbit_project_key character varying(256),
    featbit_env_id uuid,
    hypothesis text,
    access_token text,
    change text,
    constraints text,
    env_secret text,
    flag_server_url text,
    goal text,
    guardrails text,
    intent text,
    last_action text,
    last_learning text,
    open_questions text,
    primary_metric text,
    sandbox_id text,
    sandbox_status character varying(64),
    variants text,
    conflict_analysis text,
    entry_mode character varying(64),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiments PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mcp_access_token_sessions (
    id uuid NOT NULL,
    token_id character varying(128) NOT NULL,
    client_id character varying(256) NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_mcp_access_token_sessions PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mcp_device_authorizations (
    id uuid NOT NULL,
    client_id character varying(256) NOT NULL,
    device_code_hash character varying(64) NOT NULL,
    user_code character varying(16) NOT NULL,
    env_id uuid NOT NULL,
    experiment_id uuid,
    expires_at timestamp with time zone NOT NULL,
    is_approved boolean NOT NULL,
    approved_user_id uuid,
    approved_organization_id uuid,
    approved_workspace_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_mcp_device_authorizations PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mcp_refresh_authorizations (
    id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    client_id character varying(256) NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    env_id uuid NOT NULL,
    experiment_id uuid,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_mcp_refresh_authorizations PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_experiment_activities_experiment_id_created_at
    ON public.experiment_activities (experiment_id, created_at);
CREATE INDEX IF NOT EXISTS ix_experiment_exposure_events_env_id_flag_key_exposed_at
    ON public.experiment_exposure_events (env_id, flag_key, exposed_at);
CREATE INDEX IF NOT EXISTS ix_experiment_exposure_events_env_id_user_key_exposed_at
    ON public.experiment_exposure_events (env_id, user_key, exposed_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_layers_feat_bit_env_id_key
    ON public.experiment_layers (featbit_env_id, key);
CREATE INDEX IF NOT EXISTS ix_experiment_layers_feat_bit_env_id_status
    ON public.experiment_layers (featbit_env_id, status);
CREATE INDEX IF NOT EXISTS ix_experiment_metric_events_env_id_event_name_occurred_at
    ON public.experiment_metric_events (env_id, event_name, occurred_at);
CREATE INDEX IF NOT EXISTS ix_experiment_metric_events_env_id_event_name_user_key_occurre
    ON public.experiment_metric_events (env_id, event_name, user_key, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_metrics_feat_bit_env_id_key
    ON public.experiment_metrics (featbit_env_id, key);
CREATE INDEX IF NOT EXISTS ix_experiment_metrics_feat_bit_env_id_status
    ON public.experiment_metrics (featbit_env_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_id_allocation_key
    ON public.experiment_run_assignments (run_id, allocation_key);
CREATE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_id_analysis_role
    ON public.experiment_run_assignments (run_id, analysis_role);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_id_assignment_unit
    ON public.experiment_run_assignments (run_id, assignment_unit);
CREATE INDEX IF NOT EXISTS ix_experiment_run_assignments_run_id_role
    ON public.experiment_run_assignments (run_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS ix_experiment_runs_experiment_id_slug
    ON public.experiment_runs (experiment_id, slug);
CREATE INDEX IF NOT EXISTS ix_experiments_feat_bit_env_id_updated_at
    ON public.experiments (featbit_env_id, updated_at);
CREATE INDEX IF NOT EXISTS ix_experiments_feat_bit_project_key
    ON public.experiments (featbit_project_key);
CREATE INDEX IF NOT EXISTS ix_experiments_flag_key
    ON public.experiments (flag_key);
CREATE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_expires_at
    ON public.mcp_access_token_sessions (expires_at);
CREATE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_revoked_at
    ON public.mcp_access_token_sessions (revoked_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_access_token_sessions_token_id
    ON public.mcp_access_token_sessions (token_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_device_authorizations_device_code_hash
    ON public.mcp_device_authorizations (device_code_hash);
CREATE INDEX IF NOT EXISTS ix_mcp_device_authorizations_expires_at
    ON public.mcp_device_authorizations (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_device_authorizations_user_code
    ON public.mcp_device_authorizations (user_code);
CREATE INDEX IF NOT EXISTS ix_mcp_refresh_authorizations_expires_at
    ON public.mcp_refresh_authorizations (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS ix_mcp_refresh_authorizations_token_hash
    ON public.mcp_refresh_authorizations (token_hash);

COMMIT;
