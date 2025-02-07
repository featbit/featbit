CREATE TABLE end_users (
    id uuid NOT NULL,
    workspace_id uuid,
    env_id uuid,
    key_id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    customized_properties jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_end_users PRIMARY KEY (id)
);


CREATE TABLE flag_revisions (
    id uuid NOT NULL,
    flag jsonb,
    comment text,
    CONSTRAINT pk_flag_revisions PRIMARY KEY (id)
);


CREATE TABLE global_users (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    env_id uuid,
    key_id text,
    name text,
    customized_properties jsonb,
    CONSTRAINT pk_global_users PRIMARY KEY (id)
);


CREATE TABLE member (
    id uuid NOT NULL,
    email text,
    name text,
    invitor_id uuid,
    initial_password text,
    CONSTRAINT pk_member PRIMARY KEY (id)
);


CREATE TABLE workspaces (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    license text,
    sso jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_workspaces PRIMARY KEY (id)
);


CREATE TABLE member_group (
    id uuid NOT NULL,
    name text,
    description text,
    member_id uuid NOT NULL,
    is_group_member boolean NOT NULL,
    CONSTRAINT pk_member_group PRIMARY KEY (id),
    CONSTRAINT fk_member_group_member_member_id FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE
);


CREATE TABLE organizations (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    initialized boolean NOT NULL DEFAULT FALSE,
    license text,
    default_permissions jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_organizations PRIMARY KEY (id),
    CONSTRAINT fk_organizations_workspaces_workspace_id FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);


CREATE TABLE users (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password text NOT NULL,
    origin character varying(255),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT fk_users_workspaces_workspace_id FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);


CREATE TABLE access_tokens (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    status character varying(255) NOT NULL,
    token text NOT NULL,
    creator_id uuid NOT NULL,
    permissions jsonb,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_access_tokens PRIMARY KEY (id),
    CONSTRAINT fk_access_tokens_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);


CREATE TABLE groups (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_groups PRIMARY KEY (id),
    CONSTRAINT fk_groups_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);


CREATE TABLE policies (
    id uuid NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    type character varying(255) NOT NULL,
    statements jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_policies PRIMARY KEY (id),
    CONSTRAINT fk_policies_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id)
);


CREATE TABLE projects (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_projects PRIMARY KEY (id),
    CONSTRAINT fk_projects_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);


CREATE TABLE relay_proxys (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    description text,
    is_all_envs boolean NOT NULL,
    scopes jsonb,
    agents jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_relay_proxys PRIMARY KEY (id),
    CONSTRAINT fk_relay_proxys_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);


CREATE TABLE organization_users (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    invitor_id uuid,
    initial_password text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_organization_users PRIMARY KEY (id),
    CONSTRAINT fk_organization_users_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_organization_users_users_invitor_id FOREIGN KEY (invitor_id) REFERENCES users (id),
    CONSTRAINT fk_organization_users_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


CREATE TABLE webhooks (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    url text NOT NULL,
    scopes text[],
    events text[],
    headers jsonb,
    payload_template_type character varying(255),
    payload_template text,
    secret text,
    is_active boolean NOT NULL,
    prevent_empty_payloads boolean NOT NULL,
    last_delivery jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    creator_id uuid NOT NULL,
    updator_id uuid NOT NULL,
    CONSTRAINT pk_webhooks PRIMARY KEY (id),
    CONSTRAINT fk_webhooks_organizations_org_id FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_webhooks_users_creator_id FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_webhooks_users_updator_id FOREIGN KEY (updator_id) REFERENCES users (id) ON DELETE CASCADE
);


CREATE TABLE group_members (
    id uuid NOT NULL,
    group_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    member_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_group_members PRIMARY KEY (id),
    CONSTRAINT fk_group_members_groups_group_id FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
    CONSTRAINT fk_group_members_member_member_id FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE,
    CONSTRAINT fk_group_members_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);


CREATE TABLE group_policies (
    id uuid NOT NULL,
    group_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_group_policies PRIMARY KEY (id),
    CONSTRAINT fk_group_policies_groups_group_id FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
    CONSTRAINT fk_group_policies_policies_policy_id FOREIGN KEY (policy_id) REFERENCES policies (id) ON DELETE CASCADE
);


CREATE TABLE member_policies (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    member_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_member_policies PRIMARY KEY (id),
    CONSTRAINT fk_member_policies_member_member_id FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_policies_organizations_organization_id FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_policies_policies_policy_id FOREIGN KEY (policy_id) REFERENCES policies (id) ON DELETE CASCADE
);


CREATE TABLE environments (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    description text,
    secrets jsonb,
    settings jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_environments PRIMARY KEY (id),
    CONSTRAINT fk_environments_projects_project_id FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);


CREATE TABLE webhook_deliveries (
    id uuid NOT NULL,
    webhook_id uuid NOT NULL,
    success boolean NOT NULL,
    events text,
    request jsonb,
    response jsonb,
    error jsonb,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_webhook_deliveries PRIMARY KEY (id),
    CONSTRAINT fk_webhook_deliveries_webhooks_webhook_id FOREIGN KEY (webhook_id) REFERENCES webhooks (id) ON DELETE CASCADE
);


CREATE TABLE audit_logs (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    ref_id character varying(255) NOT NULL,
    ref_type character varying(255) NOT NULL,
    keyword character varying(255),
    operation character varying(255) NOT NULL,
    data_change jsonb,
    comment text,
    creator_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_audit_logs PRIMARY KEY (id),
    CONSTRAINT fk_audit_logs_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE
);


CREATE TABLE end_user_properties (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    preset_values jsonb,
    use_preset_values_only boolean NOT NULL,
    is_built_in boolean NOT NULL,
    is_digest_field boolean NOT NULL,
    remark text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_end_user_properties PRIMARY KEY (id),
    CONSTRAINT fk_end_user_properties_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE
);


CREATE TABLE experiment_metrics (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    maintainer_user_id uuid NOT NULL,
    event_name character varying(255),
    event_type integer NOT NULL,
    custom_event_track_option integer NOT NULL,
    custom_event_unit character varying(255),
    custom_event_success_criteria integer NOT NULL,
    element_targets text,
    target_urls jsonb,
    is_arvhived boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_metrics PRIMARY KEY (id),
    CONSTRAINT fk_experiment_metrics_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE,
    CONSTRAINT fk_experiment_metrics_users_maintainer_user_id FOREIGN KEY (maintainer_user_id) REFERENCES users (id) ON DELETE CASCADE
);


CREATE TABLE feature_flags (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    revision uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    key character varying(255) NOT NULL,
    variation_type character varying(255),
    variations jsonb,
    target_users jsonb,
    rules jsonb,
    is_enabled boolean NOT NULL,
    disabled_variation_id character varying(255),
    fallthrough jsonb,
    expt_include_all_targets boolean NOT NULL,
    tags text[],
    is_archived boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    creator_id uuid NOT NULL,
    updator_id uuid NOT NULL,
    CONSTRAINT pk_feature_flags PRIMARY KEY (id),
    CONSTRAINT fk_feature_flags_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE
);


CREATE TABLE segments (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    env_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    scopes text[] NOT NULL,
    description text,
    included text[],
    excluded text[],
    rules jsonb,
    is_archived boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_segments PRIMARY KEY (id),
    CONSTRAINT fk_segments_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE,
    CONSTRAINT fk_segments_workspaces_workspace_id FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);


CREATE TABLE experiments (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    metric_id uuid NOT NULL,
    feature_flag_id uuid NOT NULL,
    is_archived boolean NOT NULL,
    status character varying(255) NOT NULL,
    baseline_variation_id character varying(255),
    iterations jsonb,
    alpha double precision,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiments PRIMARY KEY (id),
    CONSTRAINT fk_experiments_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE,
    CONSTRAINT fk_experiments_experiment_metrics_metric_id FOREIGN KEY (metric_id) REFERENCES experiment_metrics (id) ON DELETE CASCADE,
    CONSTRAINT fk_experiments_feature_flags_feature_flag_id FOREIGN KEY (feature_flag_id) REFERENCES feature_flags (id) ON DELETE CASCADE
);


CREATE TABLE flag_drafts (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    status character varying(255) NOT NULL,
    comment text,
    data_change jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    creator_id uuid NOT NULL,
    updator_id uuid NOT NULL,
    CONSTRAINT pk_flag_drafts PRIMARY KEY (id),
    CONSTRAINT fk_flag_drafts_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_drafts_feature_flags_flag_id FOREIGN KEY (flag_id) REFERENCES feature_flags (id) ON DELETE CASCADE
);


CREATE TABLE triggers (
    id uuid NOT NULL,
    target_id uuid NOT NULL,
    type character varying(255) NOT NULL,
    action character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    description text NOT NULL,
    is_enabled boolean NOT NULL,
    triggered_times integer NOT NULL,
    last_triggered_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_triggers PRIMARY KEY (id),
    CONSTRAINT fk_triggers_feature_flags_target_id FOREIGN KEY (target_id) REFERENCES feature_flags (id) ON DELETE CASCADE
);


CREATE TABLE flag_change_requests (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    env_id uuid NOT NULL,
    flag_draft_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    status character varying(255) NOT NULL,
    reason text,
    reviewers jsonb,
    schedule_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    creator_id uuid NOT NULL,
    updator_id uuid NOT NULL,
    CONSTRAINT pk_flag_change_requests PRIMARY KEY (id),
    CONSTRAINT fk_flag_change_requests_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_change_requests_feature_flags_flag_id FOREIGN KEY (flag_id) REFERENCES feature_flags (id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_change_requests_flag_drafts_flag_draft_id FOREIGN KEY (flag_draft_id) REFERENCES flag_drafts (id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_change_requests_organizations_org_id FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE
);


CREATE TABLE flag_schedules (
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    env_id uuid NOT NULL,
    flag_draft_id uuid NOT NULL,
    flag_id uuid NOT NULL,
    status character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    scheduled_time timestamp with time zone NOT NULL,
    change_request_id uuid,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    creator_id uuid NOT NULL,
    updator_id uuid NOT NULL,
    CONSTRAINT pk_flag_schedules PRIMARY KEY (id),
    CONSTRAINT fk_flag_schedules_environments_env_id FOREIGN KEY (env_id) REFERENCES environments (id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_schedules_feature_flags_flag_id FOREIGN KEY (flag_id) REFERENCES feature_flags (id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_schedules_flag_drafts_flag_draft_id FOREIGN KEY (flag_draft_id) REFERENCES flag_drafts (id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_schedules_organizations_org_id FOREIGN KEY (org_id) REFERENCES organizations (id) ON DELETE CASCADE
);


CREATE INDEX ix_access_tokens_organization_id ON access_tokens (organization_id);


CREATE INDEX ix_audit_logs_env_id ON audit_logs (env_id);


CREATE INDEX ix_audit_logs_ref_id ON audit_logs (ref_id);


CREATE INDEX ix_audit_logs_ref_type ON audit_logs (ref_type);


CREATE INDEX ix_end_user_properties_env_id ON end_user_properties (env_id);


CREATE INDEX ix_end_users_env_id ON end_users (env_id);


CREATE INDEX ix_end_users_updated_at ON end_users (updated_at);


CREATE INDEX ix_environments_project_id ON environments (project_id);


CREATE INDEX ix_experiment_metrics_env_id ON experiment_metrics (env_id);


CREATE INDEX ix_experiment_metrics_maintainer_user_id ON experiment_metrics (maintainer_user_id);


CREATE INDEX ix_experiments_env_id ON experiments (env_id);


CREATE INDEX ix_experiments_feature_flag_id ON experiments (feature_flag_id);


CREATE INDEX ix_experiments_metric_id ON experiments (metric_id);


CREATE INDEX ix_feature_flags_env_id ON feature_flags (env_id);


CREATE INDEX ix_feature_flags_key ON feature_flags (key);


CREATE INDEX ix_flag_change_requests_env_id ON flag_change_requests (env_id);


CREATE INDEX ix_flag_change_requests_flag_draft_id ON flag_change_requests (flag_draft_id);


CREATE INDEX ix_flag_change_requests_flag_id ON flag_change_requests (flag_id);


CREATE INDEX ix_flag_change_requests_org_id ON flag_change_requests (org_id);


CREATE INDEX ix_flag_drafts_env_id ON flag_drafts (env_id);


CREATE INDEX ix_flag_drafts_flag_id ON flag_drafts (flag_id);


CREATE INDEX ix_flag_schedules_env_id ON flag_schedules (env_id);


CREATE INDEX ix_flag_schedules_flag_draft_id ON flag_schedules (flag_draft_id);


CREATE INDEX ix_flag_schedules_flag_id ON flag_schedules (flag_id);


CREATE INDEX ix_flag_schedules_org_id ON flag_schedules (org_id);


CREATE INDEX ix_global_users_env_id ON global_users (env_id);


CREATE INDEX ix_global_users_workspace_id ON global_users (workspace_id);


CREATE INDEX ix_group_members_group_id ON group_members (group_id);


CREATE INDEX ix_group_members_member_id ON group_members (member_id);


CREATE INDEX ix_group_members_organization_id ON group_members (organization_id);


CREATE INDEX ix_group_policies_group_id ON group_policies (group_id);


CREATE INDEX ix_group_policies_policy_id ON group_policies (policy_id);


CREATE INDEX ix_groups_organization_id ON groups (organization_id);


CREATE INDEX ix_member_group_member_id ON member_group (member_id);


CREATE INDEX ix_member_policies_member_id ON member_policies (member_id);


CREATE INDEX ix_member_policies_organization_id ON member_policies (organization_id);


CREATE INDEX ix_member_policies_policy_id ON member_policies (policy_id);


CREATE INDEX ix_organization_users_invitor_id ON organization_users (invitor_id);


CREATE UNIQUE INDEX ix_organization_users_organization_id_user_id ON organization_users (organization_id, user_id);


CREATE INDEX ix_organization_users_user_id ON organization_users (user_id);


CREATE INDEX ix_organizations_workspace_id ON organizations (workspace_id);


CREATE INDEX ix_policies_organization_id ON policies (organization_id);


CREATE UNIQUE INDEX ix_projects_organization_id_key ON projects (organization_id, key);


CREATE INDEX ix_relay_proxys_organization_id ON relay_proxys (organization_id);


CREATE INDEX ix_segments_env_id ON segments (env_id);


CREATE INDEX ix_segments_workspace_id ON segments (workspace_id);


CREATE INDEX ix_triggers_target_id ON triggers (target_id);


CREATE INDEX ix_users_workspace_id ON users (workspace_id);


CREATE INDEX ix_webhook_deliveries_webhook_id ON webhook_deliveries (webhook_id);


CREATE INDEX ix_webhooks_creator_id ON webhooks (creator_id);


CREATE INDEX ix_webhooks_org_id ON webhooks (org_id);


CREATE INDEX ix_webhooks_updator_id ON webhooks (updator_id);


