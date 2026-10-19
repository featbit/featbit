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
