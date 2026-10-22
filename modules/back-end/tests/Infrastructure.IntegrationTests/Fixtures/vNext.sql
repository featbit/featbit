\connect featbit

-- https://github.com/featbit/featbit/pull/1005
-- Per-flag insights toggle. Existing flags keep collecting insights (default true).
ALTER TABLE feature_flags
    ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true;

-- IAM audit schema under development. Tests must not depend on the local-only
-- infra v6.0.1.sql migration (which also migrates production history).
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS workspace_id uuid NOT NULL,
    ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE audit_logs ALTER COLUMN env_id DROP NOT NULL;
DROP INDEX IF EXISTS ix_audit_logs_env_id_ref_id_created_at;
DROP INDEX IF EXISTS ix_audit_logs_workspace_created;
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_env_created
    ON audit_logs(workspace_id, env_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_resource_created
    ON audit_logs(workspace_id, ref_type, ref_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_org_created
    ON audit_logs(workspace_id, organization_id, created_at DESC, id DESC);
