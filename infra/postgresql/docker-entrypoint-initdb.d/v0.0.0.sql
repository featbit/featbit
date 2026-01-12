-- 0. create the database
create database featbit;

-- 1. create tables

\connect featbit

CREATE TABLE access_tokens
(
    id              uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    name            character varying(128)   NOT NULL,
    type            character varying(64)    NOT NULL,
    status          character varying(64)    NOT NULL,
    token           text                     NOT NULL,
    creator_id      uuid                     NOT NULL,
    permissions     jsonb,
    last_used_at    timestamp with time zone,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_access_tokens PRIMARY KEY (id)
);


CREATE TABLE audit_logs
(
    id          uuid                     NOT NULL,
    env_id      uuid                     NOT NULL,
    ref_id      text                     NOT NULL,
    ref_type    character varying(64)    NOT NULL,
    keyword     character varying(128)   NOT NULL,
    operation   character varying(64)    NOT NULL,
    data_change jsonb,
    comment     character varying(512),
    creator_id  uuid                     NOT NULL,
    created_at  timestamp with time zone NOT NULL,
    CONSTRAINT pk_audit_logs PRIMARY KEY (id)
);


CREATE TABLE end_user_properties
(
    id                     uuid                     NOT NULL,
    env_id                 uuid                     NOT NULL,
    name                   character varying(128)   NOT NULL,
    preset_values          jsonb,
    use_preset_values_only boolean                  NOT NULL,
    is_built_in            boolean                  NOT NULL,
    is_digest_field        boolean                  NOT NULL,
    remark                 text,
    created_at             timestamp with time zone NOT NULL,
    updated_at             timestamp with time zone NOT NULL,
    CONSTRAINT pk_end_user_properties PRIMARY KEY (id)
);


CREATE TABLE end_users
(
    id                    uuid                     NOT NULL,
    workspace_id          uuid,
    env_id                uuid,
    key_id                character varying(512)   NOT NULL,
    name                  character varying(256)   NOT NULL,
    customized_properties jsonb,
    created_at            timestamp with time zone NOT NULL,
    updated_at            timestamp with time zone NOT NULL,
    CONSTRAINT pk_end_users PRIMARY KEY (id)
);


CREATE TABLE environments
(
    id          uuid                     NOT NULL,
    project_id  uuid                     NOT NULL,
    name        character varying(128)   NOT NULL,
    key         character varying(128)   NOT NULL,
    description text,
    secrets     jsonb,
    settings    jsonb,
    created_at  timestamp with time zone NOT NULL,
    updated_at  timestamp with time zone NOT NULL,
    CONSTRAINT pk_environments PRIMARY KEY (id)
);


CREATE TABLE experiment_metrics
(
    id                            uuid                     NOT NULL,
    env_id                        uuid                     NOT NULL,
    name                          character varying(128)   NOT NULL,
    description                   text,
    maintainer_user_id            uuid                     NOT NULL,
    event_name                    character varying(128)   NOT NULL,
    event_type                    integer                  NOT NULL,
    custom_event_track_option     integer                  NOT NULL,
    custom_event_unit             character varying(128),
    custom_event_success_criteria integer                  NOT NULL,
    element_targets               text,
    target_urls                   jsonb,
    is_arvhived                   boolean                  NOT NULL,
    created_at                    timestamp with time zone NOT NULL,
    updated_at                    timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiment_metrics PRIMARY KEY (id)
);


CREATE TABLE experiments
(
    id                    uuid                     NOT NULL,
    env_id                uuid                     NOT NULL,
    metric_id             uuid                     NOT NULL,
    feature_flag_id       uuid                     NOT NULL,
    is_archived           boolean                  NOT NULL,
    status                character varying(64)    NOT NULL,
    baseline_variation_id text,
    iterations            jsonb,
    alpha                 double precision,
    created_at            timestamp with time zone NOT NULL,
    updated_at            timestamp with time zone NOT NULL,
    CONSTRAINT pk_experiments PRIMARY KEY (id)
);


CREATE TABLE feature_flags
(
    id                       uuid                     NOT NULL,
    env_id                   uuid                     NOT NULL,
    revision                 uuid                     NOT NULL,
    name                     character varying(128)   NOT NULL,
    description              text,
    key                      character varying(128)   NOT NULL,
    variation_type           character varying(64)    NOT NULL,
    variations               jsonb,
    target_users             jsonb,
    rules                    jsonb,
    is_enabled               boolean                  NOT NULL,
    disabled_variation_id    character varying(128)   NOT NULL,
    fallthrough              jsonb,
    expt_include_all_targets boolean                  NOT NULL,
    tags                     text[],
    is_archived              boolean                  NOT NULL,
    created_at               timestamp with time zone NOT NULL,
    updated_at               timestamp with time zone NOT NULL,
    creator_id               uuid                     NOT NULL,
    updator_id               uuid                     NOT NULL,
    CONSTRAINT pk_feature_flags PRIMARY KEY (id)
);


CREATE TABLE flag_change_requests
(
    id            uuid                     NOT NULL,
    org_id        uuid                     NOT NULL,
    env_id        uuid                     NOT NULL,
    flag_draft_id uuid                     NOT NULL,
    flag_id       uuid                     NOT NULL,
    status        character varying(64)    NOT NULL,
    reason        character varying(512),
    reviewers     jsonb,
    schedule_id   uuid,
    created_at    timestamp with time zone NOT NULL,
    updated_at    timestamp with time zone NOT NULL,
    creator_id    uuid                     NOT NULL,
    updator_id    uuid                     NOT NULL,
    CONSTRAINT pk_flag_change_requests PRIMARY KEY (id)
);


CREATE TABLE flag_drafts
(
    id          uuid                     NOT NULL,
    env_id      uuid                     NOT NULL,
    flag_id     uuid                     NOT NULL,
    status      character varying(64)    NOT NULL,
    comment     character varying(512),
    data_change jsonb,
    created_at  timestamp with time zone NOT NULL,
    updated_at  timestamp with time zone NOT NULL,
    creator_id  uuid                     NOT NULL,
    updator_id  uuid                     NOT NULL,
    CONSTRAINT pk_flag_drafts PRIMARY KEY (id)
);


CREATE TABLE flag_revisions
(
    id      uuid NOT NULL,
    flag    jsonb,
    comment character varying(512),
    CONSTRAINT pk_flag_revisions PRIMARY KEY (id)
);


CREATE TABLE flag_schedules
(
    id                uuid                     NOT NULL,
    org_id            uuid                     NOT NULL,
    env_id            uuid                     NOT NULL,
    flag_draft_id     uuid                     NOT NULL,
    flag_id           uuid                     NOT NULL,
    status            character varying(64)    NOT NULL,
    title             character varying(128)   NOT NULL,
    scheduled_time    timestamp with time zone NOT NULL,
    change_request_id uuid,
    created_at        timestamp with time zone NOT NULL,
    updated_at        timestamp with time zone NOT NULL,
    creator_id        uuid                     NOT NULL,
    updator_id        uuid                     NOT NULL,
    CONSTRAINT pk_flag_schedules PRIMARY KEY (id)
);


CREATE TABLE group_members
(
    id              uuid                     NOT NULL,
    group_id        uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    member_id       uuid                     NOT NULL,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_group_members PRIMARY KEY (id)
);


CREATE TABLE group_policies
(
    id         uuid                     NOT NULL,
    group_id   uuid                     NOT NULL,
    policy_id  uuid                     NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_group_policies PRIMARY KEY (id)
);


CREATE TABLE groups
(
    id              uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    name            character varying(128)   NOT NULL,
    description     text,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_groups PRIMARY KEY (id)
);


CREATE TABLE member_policies
(
    id              uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    member_id       uuid                     NOT NULL,
    policy_id       uuid                     NOT NULL,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_member_policies PRIMARY KEY (id)
);


CREATE TABLE organization_users
(
    id               uuid                     NOT NULL,
    organization_id  uuid                     NOT NULL,
    user_id          uuid                     NOT NULL,
    invitor_id       uuid,
    initial_password text,
    created_at       timestamp with time zone NOT NULL,
    updated_at       timestamp with time zone NOT NULL,
    CONSTRAINT pk_organization_users PRIMARY KEY (id)
);


CREATE TABLE organizations
(
    id                  uuid                     NOT NULL,
    workspace_id        uuid                     NOT NULL,
    name                character varying(128)   NOT NULL,
    key                 character varying(128)   NOT NULL,
    initialized         boolean                  NOT NULL DEFAULT FALSE,
    license             text,
    default_permissions jsonb                    NOT NULL,
    created_at          timestamp with time zone NOT NULL,
    updated_at          timestamp with time zone NOT NULL,
    CONSTRAINT pk_organizations PRIMARY KEY (id)
);


CREATE TABLE policies
(
    id              uuid                     NOT NULL,
    organization_id uuid,
    name            character varying(128)   NOT NULL,
    description     character varying(512),
    type            character varying(64)    NOT NULL,
    statements      jsonb,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_policies PRIMARY KEY (id)
);


CREATE TABLE projects
(
    id              uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    name            character varying(128)   NOT NULL,
    key             character varying(128)   NOT NULL,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_projects PRIMARY KEY (id)
);


CREATE TABLE queue_messages
(
    id                bigint GENERATED ALWAYS AS IDENTITY,
    topic             character varying(128)   NOT NULL,
    status            character varying(64)    NOT NULL DEFAULT 'Pending',
    enqueued_at       timestamp with time zone NOT NULL DEFAULT (now()),
    not_visible_until timestamp with time zone,
    last_deliver_at   timestamp with time zone,
    last_handled_at   timestamp with time zone,
    deliver_count     integer                  NOT NULL DEFAULT 0,
    payload           text,
    error             text,
    CONSTRAINT pk_queue_messages PRIMARY KEY (id)
);


CREATE TABLE relay_proxies
(
    id              uuid                     NOT NULL,
    organization_id uuid                     NOT NULL,
    name            character varying(128)   NOT NULL,
    key             character varying(128)   NOT NULL,
    description     character varying(512),
    is_all_envs     boolean                  NOT NULL,
    scopes          jsonb,
    agents          jsonb,
    created_at      timestamp with time zone NOT NULL,
    updated_at      timestamp with time zone NOT NULL,
    CONSTRAINT pk_relay_proxies PRIMARY KEY (id)
);


CREATE TABLE segments
(
    id           uuid                     NOT NULL,
    workspace_id uuid                     NOT NULL,
    env_id       uuid                     NOT NULL,
    name         character varying(128)   NOT NULL,
    type         character varying(64)    NOT NULL,
    scopes       text[],
    description  character varying(512),
    included     text[],
    excluded     text[],
    rules        jsonb,
    is_archived  boolean                  NOT NULL,
    created_at   timestamp with time zone NOT NULL,
    updated_at   timestamp with time zone NOT NULL,
    CONSTRAINT pk_segments PRIMARY KEY (id)
);


CREATE TABLE triggers
(
    id                uuid                     NOT NULL,
    target_id         uuid                     NOT NULL,
    type              character varying(64)    NOT NULL,
    action            character varying(64)    NOT NULL,
    token             character varying(128)   NOT NULL,
    description       text                     NOT NULL,
    is_enabled        boolean                  NOT NULL,
    triggered_times   integer                  NOT NULL,
    last_triggered_at timestamp with time zone,
    created_at        timestamp with time zone NOT NULL,
    updated_at        timestamp with time zone NOT NULL,
    CONSTRAINT pk_triggers PRIMARY KEY (id)
);


CREATE TABLE users
(
    id           uuid                     NOT NULL,
    workspace_id uuid                     NOT NULL,
    name         character varying(128)   NOT NULL,
    email        character varying(256)   NOT NULL,
    password     text                     NOT NULL,
    origin       character varying(64),
    created_at   timestamp with time zone NOT NULL,
    updated_at   timestamp with time zone NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id)
);


CREATE TABLE webhook_deliveries
(
    id         uuid                     NOT NULL,
    webhook_id uuid                     NOT NULL,
    success    boolean                  NOT NULL,
    events     text,
    request    jsonb,
    response   jsonb,
    error      jsonb,
    started_at timestamp with time zone NOT NULL,
    ended_at   timestamp with time zone NOT NULL,
    CONSTRAINT pk_webhook_deliveries PRIMARY KEY (id)
);


CREATE TABLE webhooks
(
    id                     uuid                     NOT NULL,
    org_id                 uuid                     NOT NULL,
    name                   character varying(128)   NOT NULL,
    url                    text                     NOT NULL,
    scopes                 text[],
    events                 text[],
    headers                jsonb,
    payload_template_type  character varying(64),
    payload_template       text,
    secret                 text,
    is_active              boolean                  NOT NULL,
    prevent_empty_payloads boolean                  NOT NULL,
    last_delivery          jsonb,
    created_at             timestamp with time zone NOT NULL,
    updated_at             timestamp with time zone NOT NULL,
    creator_id             uuid                     NOT NULL,
    updator_id             uuid                     NOT NULL,
    CONSTRAINT pk_webhooks PRIMARY KEY (id)
);


CREATE TABLE workspaces
(
    id         uuid                     NOT NULL,
    name       character varying(128)   NOT NULL,
    key        character varying(128)   NOT NULL,
    license    text,
    sso        jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_workspaces PRIMARY KEY (id)
);


CREATE INDEX ix_access_tokens_organization_id ON access_tokens (organization_id);


CREATE INDEX ix_audit_logs_env_id_ref_id_created_at ON audit_logs (env_id, ref_id, created_at);


CREATE UNIQUE INDEX ix_end_users_env_id_key_id ON end_users (env_id, key_id);


CREATE INDEX ix_end_users_updated_at ON end_users (updated_at);


CREATE INDEX ix_end_users_workspace_id ON end_users (workspace_id);


CREATE INDEX ix_environments_project_id ON environments (project_id);


CREATE INDEX ix_experiment_metrics_env_id ON experiment_metrics (env_id);


CREATE INDEX ix_experiments_env_id_feature_flag_id ON experiments (env_id, feature_flag_id);


CREATE INDEX ix_feature_flags_env_id_updated_at ON feature_flags (env_id, updated_at);


CREATE INDEX ix_flag_change_requests_flag_id ON flag_change_requests (flag_id);


CREATE INDEX ix_flag_schedules_flag_id ON flag_schedules (flag_id);


CREATE INDEX ix_group_members_organization_id_group_id_member_id ON group_members (organization_id, group_id, member_id);


CREATE INDEX ix_group_policies_group_id_policy_id ON group_policies (group_id, policy_id);


CREATE INDEX ix_groups_organization_id ON groups (organization_id);


CREATE INDEX ix_member_policies_organization_id_member_id_policy_id ON member_policies (organization_id, member_id, policy_id);


CREATE INDEX ix_organization_users_organization_id_user_id ON organization_users (organization_id, user_id);


CREATE INDEX ix_organizations_workspace_id ON organizations (workspace_id);


CREATE INDEX ix_policies_organization_id ON policies (organization_id);


CREATE INDEX ix_projects_organization_id ON projects (organization_id);


CREATE INDEX ix_queue_messages_not_visible_until_topic_status ON queue_messages (not_visible_until, topic, status);


CREATE INDEX ix_relay_proxies_organization_id ON relay_proxies (organization_id);


CREATE INDEX ix_segments_workspace_id_updated_at ON segments (workspace_id, updated_at);


CREATE INDEX ix_triggers_target_id ON triggers (target_id);


CREATE UNIQUE INDEX ix_users_workspace_id_email ON users (workspace_id, email);


CREATE INDEX ix_webhook_deliveries_webhook_id_started_at ON webhook_deliveries (webhook_id, started_at);


CREATE INDEX ix_webhooks_org_id_created_at ON webhooks (org_id, created_at);

-- 2. seed data

DO
$$
    DECLARE
        workspace_id            UUID := gen_random_uuid();
        user_id                 UUID := gen_random_uuid();
        organization_id         UUID := gen_random_uuid();
        -- Built-in policies
        owner_policy_id         UUID := '98881f6a-5c6c-4277-bcf7-fda94c538785';
        administrator_policy_id UUID := '3e961f0f-6fd4-4cf4-910f-52d356f8cc08';
        developer_policy_id     UUID := '66f3687f-939f-4257-bd3f-c3553d39e1b6';
    BEGIN
        -- truncate tables
        TRUNCATE TABLE workspaces CASCADE;
        TRUNCATE TABLE users CASCADE;
        TRUNCATE TABLE organizations CASCADE;
        TRUNCATE TABLE organization_users CASCADE;
        TRUNCATE TABLE policies CASCADE;
        TRUNCATE TABLE member_policies CASCADE;

-- seed workspace
        INSERT INTO workspaces (id, name, key, sso, license, created_at, updated_at)
        VALUES (workspace_id, 'Default Workspace', 'default-workspace', NULL, NULL, CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP);

-- seed user
        INSERT INTO users (id, email, password, name, origin, workspace_id, created_at, updated_at)
        VALUES (user_id, 'test@featbit.com',
                'AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==',
                'tester', 'Local', workspace_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed organization
        INSERT INTO organizations (id, workspace_id, name, key, initialized, default_permissions, created_at,
                                   updated_at)
        VALUES (organization_id, workspace_id, 'playground', 'playground', false,
                jsonb_build_object('policyIds', jsonb_build_array(developer_policy_id), 'groupIds',
                                   jsonb_build_array()),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed organization users
        INSERT INTO organization_users (id, organization_id, user_id, invitor_id, initial_password, created_at,
                                        updated_at)
        VALUES (gen_random_uuid(), organization_id, user_id, NULL, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed system managed policies
        INSERT INTO policies (id, organization_id, name, description, type, statements, created_at, updated_at)
        VALUES (owner_policy_id, NULL, 'Owner',
                'Contains all permissions. This policy is granted to the user who created the organization',
                'SysManaged',
                jsonb_build_array(
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', '*',
                                'effect', 'allow',
                                'actions', ARRAY ['*'],
                                'resources', ARRAY ['*']
                        )
                ),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

               (administrator_policy_id, NULL, 'Administrator',
                'Contains all the permissions required by an administrator',
                'SysManaged',
                jsonb_build_array(
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'organization',
                                'effect', 'allow',
                                'actions', ARRAY ['UpdateOrgName'],
                                'resources', ARRAY ['organization/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'organization',
                                'effect', 'allow',
                                'actions', ARRAY ['UpdateOrgDefaultUserPermissions'],
                                'resources', ARRAY ['organization/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'iam',
                                'effect', 'allow',
                                'actions', ARRAY ['CanManageIAM'],
                                'resources', ARRAY ['iam/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'access-token',
                                'effect', 'allow',
                                'actions',
                                ARRAY ['ManageServiceAccessTokens', 'ManagePersonalAccessTokens', 'ListAccessTokens'],
                                'resources', ARRAY ['access-token/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'relay-proxy',
                                'effect', 'allow',
                                'actions', ARRAY ['ManageRelayProxies', 'ListRelayProxies'],
                                'resources', ARRAY ['relay-proxy/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'project',
                                'effect', 'allow',
                                'actions', ARRAY ['CanAccessProject', 'CreateProject', 'DeleteProject', 'UpdateProjectSettings', 'CreateEnv'],
                                'resources', ARRAY ['project/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'env',
                                'effect', 'allow',
                                'actions', ARRAY ['DeleteEnv', 'UpdateEnvSettings', 'CreateEnvSecret', 'DeleteEnvSecret', 'UpdateEnvSecret'],
                                'resources', ARRAY ['project/*:env/*']
                        )
                ),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

               (developer_policy_id, NULL, 'Developer',
                'Contains all the permissions required by a developer',
                'SysManaged',
                jsonb_build_array(
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'access-token',
                                'effect', 'allow',
                                'actions',
                                ARRAY ['ManageServiceAccessTokens', 'ManagePersonalAccessTokens', 'ListAccessTokens'],
                                'resources', ARRAY ['access-token/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'relay-proxy',
                                'effect', 'allow',
                                'actions', ARRAY ['ManageRelayProxies', 'ListRelayProxies'],
                                'resources', ARRAY ['relay-proxy/*']
                        ),
                        jsonb_build_object(
                                'id', gen_random_uuid(),
                                'resourceType', 'project',
                                'effect', 'allow',
                                'actions', ARRAY ['CanAccessProject'],
                                'resources', ARRAY ['project/*']
                        )
                ),
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed member policy
        INSERT INTO member_policies (id, organization_id, policy_id, member_id, created_at, updated_at)
        VALUES (gen_random_uuid(), organization_id, owner_policy_id, user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    END
$$;