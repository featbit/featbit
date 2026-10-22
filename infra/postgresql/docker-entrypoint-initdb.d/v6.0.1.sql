\connect featbit

-- Workspace audit history / IAM. Run with ON_ERROR_STOP; unresolved ownership
-- aborts without deleting or exposing historical records.
BEGIN;
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS workspace_id uuid,
    ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE audit_logs ALTER COLUMN env_id DROP NOT NULL;

-- Recover shared-segment environment IDs cleared by an earlier migration.
-- Workspace and organization ownership are resolved from that environment below.
WITH snapshots AS (
    SELECT id, COALESCE(NULLIF(data_change->>'current', ''), NULLIF(data_change->>'previous', ''))::jsonb AS value
    FROM audit_logs WHERE ref_type = 'Segment' AND env_id IS NULL
)
UPDATE audit_logs a SET env_id = NULLIF(s.value->>'envId', '')::uuid
FROM snapshots s WHERE a.id = s.id AND s.value->>'type' = 'shared'
    AND NULLIF(s.value->>'envId', '') IS NOT NULL;

UPDATE audit_logs a SET workspace_id = o.workspace_id, organization_id = o.id
FROM environments e JOIN projects p ON p.id = e.project_id
JOIN organizations o ON o.id = p.organization_id
WHERE a.env_id = e.id
    AND (a.workspace_id IS NULL OR a.organization_id IS NULL);

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM audit_logs
        WHERE workspace_id IS NULL
            OR (ref_type IN ('FeatureFlag', 'Segment') AND env_id IS NULL)
            OR (env_id IS NOT NULL AND organization_id IS NULL)
    ) THEN
        RAISE EXCEPTION 'Audit logs have unresolved ownership. Restore verified environment ownership before rerunning v6.0.1; no audit history was removed.';
    END IF;
END $$;

ALTER TABLE audit_logs ALTER COLUMN workspace_id SET NOT NULL;
-- Replace the environment-only resource index with workspace-scoped indexes.
DROP INDEX IF EXISTS ix_audit_logs_env_id_ref_id_created_at;
DROP INDEX IF EXISTS ix_audit_logs_workspace_created;
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_env_created ON audit_logs(workspace_id, env_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_resource_created ON audit_logs(workspace_id, ref_type, ref_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_org_created ON audit_logs(workspace_id, organization_id, created_at DESC, id DESC);
COMMIT;
