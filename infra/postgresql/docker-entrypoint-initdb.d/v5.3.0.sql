\connect featbit

-- https://github.com/featbit/featbit/pull/868
-- added refresh_tokens table to support refresh token rotation and revocation
CREATE TABLE refresh_tokens
(
    id                uuid primary key                  default gen_random_uuid(),
    token             varchar(500)             not null unique,
    user_id           uuid                     not null,
    is_revoked        boolean                  not null default false,
    replaced_by_token varchar(500)             null,
    created_by_ip     varchar(45)              null,
    revoked_by_ip     varchar(45)              null,
    expires_at        timestamp with time zone not null,
    revoked_at        timestamp with time zone null,
    last_used_at      timestamp with time zone null,
    created_at        timestamp with time zone not null default now(),
    updated_at        timestamp with time zone not null
);

CREATE INDEX ix_refresh_tokens_token ON refresh_tokens (token);
CREATE INDEX ix_refresh_tokens_revoked_at ON refresh_tokens (revoked_at);