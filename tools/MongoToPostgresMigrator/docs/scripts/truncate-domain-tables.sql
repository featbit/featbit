-- Empties the 29 FeatBit domain tables so the MongoToPostgresMigrator preflight
-- can run (it refuses to migrate into a non-empty target).
--
-- This is the complete domain-table set for the current schema
-- (infra/postgresql/docker-entrypoint-initdb.d, up to v5.4.1). It intentionally
-- leaves queue_messages and the usage_* analytics tables untouched.
--
-- PostgreSQL defines no foreign keys between these tables, so a plain TRUNCATE
-- of the whole set succeeds regardless of order.
--
-- Run it against the target database, e.g.
--   psql -h <host> -U <user> -d <database> -f truncate-domain-tables.sql
-- Deliberately no '\connect' here: the database is chosen by the caller, so this
-- file never overrides a non-default target.

TRUNCATE
    workspaces,
    workspace_users,
    users,
    refresh_tokens,
    organizations,
    organization_users,
    projects,
    environments,
    policies,
    groups,
    group_members,
    group_policies,
    member_policies,
    segments,
    feature_flags,
    flag_drafts,
    flag_revisions,
    flag_schedules,
    flag_change_requests,
    triggers,
    experiment_metrics,
    experiments,
    access_tokens,
    relay_proxies,
    webhooks,
    webhook_deliveries,
    end_user_properties,
    end_users,
    audit_logs;
