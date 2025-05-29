\connect featbit

-- https://github.com/featbit/featbit/pull/754
UPDATE policies
SET statements = statements || jsonb_build_object(
        '_id', gen_random_uuid(),
        'resourceType', 'workspace',
        'effect', 'allow',
        'actions', '["UpdateWorkspaceGeneralSettings", "UpdateWorkspaceLicense", "UpdateWorkspaceSSOSettings"]'::jsonb,
        'resources', '["workspace/*"]'::jsonb
                               )
WHERE id = '3e961f0f-6fd4-4cf4-910f-52d356f8cc08'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(statements) AS stmt
    WHERE stmt ->> 'resourceType' = 'workspace'
);