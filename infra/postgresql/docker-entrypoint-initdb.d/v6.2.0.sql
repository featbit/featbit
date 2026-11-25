\connect featbit

CREATE TABLE IF NOT EXISTS release_metric_source_connections
(
    id                       uuid PRIMARY KEY,
    env_id                   uuid                     NOT NULL,
    name                     varchar(256)             NOT NULL,
    provider_type            varchar(64)              NOT NULL,
    connection_configuration jsonb                    NOT NULL,
    protected_credential     text,
    is_deleted               boolean                  NOT NULL DEFAULT false,
    created_at               timestamp with time zone NOT NULL,
    updated_at               timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_release_metric_source_connections_env_id
    ON release_metric_source_connections (env_id)
    WHERE NOT is_deleted;
