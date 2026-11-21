\connect featbit

CREATE TABLE IF NOT EXISTS observability_providers
(
    id                       uuid PRIMARY KEY,
    env_id                   uuid                     NOT NULL,
    name                     varchar(256)             NOT NULL,
    provider_type            varchar(64)              NOT NULL,
    provider_schema_version  integer                  NOT NULL,
    connection_configuration jsonb                    NOT NULL,
    protected_credential     text,
    revision                 bigint                   NOT NULL,
    version                  bigint                   NOT NULL,
    is_deleted               boolean                  NOT NULL DEFAULT false,
    creator_id               uuid                     NOT NULL,
    updator_id               uuid                     NOT NULL,
    created_at               timestamp with time zone NOT NULL,
    updated_at               timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_observability_providers_env_id_name
    ON observability_providers (env_id, name) WHERE NOT is_deleted;
