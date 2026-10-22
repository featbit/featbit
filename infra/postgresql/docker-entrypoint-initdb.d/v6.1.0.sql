\connect featbit

-- https://github.com/featbit/featbit/pull/1005
-- Per-flag insights toggle. Existing flags keep collecting insights (default true).
ALTER TABLE feature_flags
    ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true;

-- ViewEnvSecret is independent at runtime. Preserve existing secret managers'
-- access and grant the built-in Developer read access for SDK integration.
UPDATE policies p
SET statements = (
    SELECT jsonb_agg(
        CASE WHEN s->>'effect' = 'allow'
                  AND s->>'resourceType' = 'env'
                  AND NOT (COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['ViewEnvSecret', '*'])
                  AND (
                      COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['CreateEnvSecret', 'UpdateEnvSecret', 'DeleteEnvSecret']
                      OR (p.type = 'SysManaged' AND p.organization_id IS NULL AND p.name = 'Developer'
                          AND COALESCE(s->'actions', '[]'::jsonb) ? 'CanAccessEnv')
                  )
             THEN jsonb_set(s, '{actions}', s->'actions' || '["ViewEnvSecret"]'::jsonb)
             ELSE s END
        ORDER BY position
    )
    FROM jsonb_array_elements(p.statements) WITH ORDINALITY AS statement(s, position)
)
WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.statements) s
    WHERE s->>'effect' = 'allow' AND s->>'resourceType' = 'env'
      AND NOT (COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['ViewEnvSecret', '*'])
      AND (COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['CreateEnvSecret', 'UpdateEnvSecret', 'DeleteEnvSecret']
           OR (p.type = 'SysManaged' AND p.organization_id IS NULL AND p.name = 'Developer'
               AND COALESCE(s->'actions', '[]'::jsonb) ? 'CanAccessEnv'))
);

-- Service tokens store their own permissions rather than inheriting policies.
UPDATE access_tokens t
SET permissions = (
    SELECT jsonb_agg(
        CASE WHEN s->>'effect' = 'allow'
                  AND s->>'resourceType' = 'env'
                  AND NOT (COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['ViewEnvSecret', '*'])
                  AND COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['CreateEnvSecret', 'UpdateEnvSecret', 'DeleteEnvSecret']
             THEN jsonb_set(s, '{actions}', s->'actions' || '["ViewEnvSecret"]'::jsonb)
             ELSE s END
        ORDER BY position
    )
    FROM jsonb_array_elements(t.permissions) WITH ORDINALITY AS statement(s, position)
)
WHERE t.type = 'Service'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(t.permissions) s
    WHERE s->>'effect' = 'allow' AND s->>'resourceType' = 'env'
      AND NOT (COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['ViewEnvSecret', '*'])
      AND COALESCE(s->'actions', '[]'::jsonb) ?| ARRAY['CreateEnvSecret', 'UpdateEnvSecret', 'DeleteEnvSecret']
);


-- IAM audit logs. Keep the ownership backfill and constraints atomic.
BEGIN;
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS workspace_id uuid,
    ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE audit_logs ALTER COLUMN env_id DROP NOT NULL;

-- Resolve historical ownership from the environment, never from request context.
-- Do not overwrite explicit ownership (shared segments can have a null organization).
UPDATE audit_logs a SET workspace_id = o.workspace_id, organization_id = o.id
FROM environments e
JOIN projects p ON p.id = e.project_id
JOIN organizations o ON o.id = p.organization_id
WHERE a.workspace_id IS NULL AND a.env_id = e.id;

-- Shared segments belong to the workspace, including records already backfilled.
-- Deleted segments retain their type in the previous snapshot.
UPDATE audit_logs SET organization_id = NULL
WHERE ref_type = 'Segment' AND organization_id IS NOT NULL
    AND COALESCE(NULLIF(data_change->>'current', ''), NULLIF(data_change->>'previous', ''))::jsonb->>'type' = 'shared';

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM audit_logs WHERE workspace_id IS NULL) THEN
        RAISE EXCEPTION 'Audit logs have unresolved workspace ownership. Restore verified environment/project/organization ownership before rerunning v6.1.0; no audit history was removed.';
    END IF;
END $$;

ALTER TABLE audit_logs ALTER COLUMN workspace_id SET NOT NULL;
DROP INDEX IF EXISTS ix_audit_logs_env_id_ref_id_created_at;
DROP INDEX IF EXISTS ix_audit_logs_workspace_created;
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_env_created
    ON audit_logs(workspace_id, env_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_resource_created
    ON audit_logs(workspace_id, ref_type, ref_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_org_created
    ON audit_logs(workspace_id, organization_id, created_at DESC, id DESC);
COMMIT;
