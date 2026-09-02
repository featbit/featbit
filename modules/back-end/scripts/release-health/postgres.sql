-- Additive, repeatable migration for existing PostgreSQL installations.
-- Run against the FeatBit application database before using the Release Health live slice.
CREATE TABLE IF NOT EXISTS release_health_documents (
    id uuid NOT NULL,
    scope_id uuid NOT NULL,
    project_id uuid NOT NULL,
    kind varchar(32) NOT NULL,
    natural_key varchar(160) NOT NULL,
    version bigint NOT NULL CHECK (version > 0),
    payload text NOT NULL,
    protected_secrets text NULL,
    PRIMARY KEY (scope_id, kind, id),
    UNIQUE (scope_id, kind, natural_key)
);
