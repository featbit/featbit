CREATE TABLE workspace (
    id uuid NOT NULL,
    name character varying(32) NOT NULL,
    key character varying(64) NOT NULL,
    license text,
    sso jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_workspace PRIMARY KEY (id)
);


CREATE TABLE organization (
    id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    name character varying(64) NOT NULL,
    key character varying(64) NOT NULL,
    initialized boolean NOT NULL,
    license text,
    default_permissions jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_organization PRIMARY KEY (id),
    CONSTRAINT fk_organization_workspace_workspace_id FOREIGN KEY (workspace_id) REFERENCES workspace (id) ON DELETE CASCADE
);


CREATE TABLE project (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(64) NOT NULL,
    key character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_project PRIMARY KEY (id),
    CONSTRAINT fk_project_organization_organization_id FOREIGN KEY (organization_id) REFERENCES organization (id) ON DELETE CASCADE
);


CREATE TABLE environment (
    id uuid NOT NULL,
    project_id uuid NOT NULL,
    name character varying(64) NOT NULL,
    key character varying(64) NOT NULL,
    description character varying(512),
    secrets jsonb,
    settings jsonb,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT pk_environment PRIMARY KEY (id),
    CONSTRAINT fk_environment_project_project_id FOREIGN KEY (project_id) REFERENCES project (id) ON DELETE CASCADE
);


CREATE TABLE feature_flags (
    id uuid NOT NULL,
    env_id uuid NOT NULL,
    revision uuid NOT NULL,
    name text,
    description text,
    key text,
    variation_type text,
    variations jsonb,
    target_users jsonb,
    rules jsonb,
    is_enabled boolean NOT NULL,
    disabled_variation_id text,
    fallthrough jsonb,
    expt_include_all_targets boolean NOT NULL,
    tags text[],
    is_archived boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    creator_id uuid NOT NULL,
    updator_id uuid NOT NULL,
    CONSTRAINT pk_feature_flags PRIMARY KEY (id),
    CONSTRAINT fk_feature_flags_environment_env_id FOREIGN KEY (env_id) REFERENCES environment (id) ON DELETE CASCADE
);


CREATE INDEX ix_environment_project_id ON environment (project_id);


CREATE INDEX ix_feature_flags_env_id ON feature_flags (env_id);


CREATE INDEX ix_organization_workspace_id ON organization (workspace_id);


CREATE INDEX ix_project_organization_id ON project (organization_id);


