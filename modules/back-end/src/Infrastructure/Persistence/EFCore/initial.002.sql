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


CREATE TABLE global_users (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    env_id uuid,
    key_id text,
    name text,
    customized_properties jsonb,
    CONSTRAINT pk_global_users PRIMARY KEY (id)
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


CREATE INDEX ix_end_user_properties_env_id ON end_user_properties (env_id);


CREATE INDEX ix_end_users_env_id ON end_users (env_id);


CREATE INDEX ix_end_users_updated_at ON end_users (updated_at);


CREATE INDEX ix_environments_project_id ON environments (project_id);


CREATE INDEX ix_feature_flags_env_id ON feature_flags (env_id);


CREATE INDEX ix_feature_flags_key ON feature_flags (key);


CREATE INDEX ix_global_users_env_id ON global_users (env_id);


CREATE INDEX ix_global_users_workspace_id ON global_users (workspace_id);


CREATE INDEX ix_organization_users_invitor_id ON organization_users (invitor_id);


CREATE UNIQUE INDEX ix_organization_users_organization_id_user_id ON organization_users (organization_id, user_id);


CREATE INDEX ix_organization_users_user_id ON organization_users (user_id);


CREATE INDEX ix_organizations_workspace_id ON organizations (workspace_id);


CREATE UNIQUE INDEX ix_projects_organization_id_key ON projects (organization_id, key);


CREATE INDEX ix_segments_env_id ON segments (env_id);


CREATE INDEX ix_segments_workspace_id ON segments (workspace_id);


CREATE INDEX ix_users_workspace_id ON users (workspace_id);


