\connect featbit

-- https://github.com/featbit/featbit/pull/754
UPDATE policies
SET statements = (
  -- Rebuild the statements array without existing 'organization' statements
  (
    SELECT jsonb_agg(stmt)
    FROM jsonb_array_elements(statements) AS stmt
    WHERE stmt ->> 'resourceType' != 'organization'
  ) || jsonb_build_object(
    'id', gen_random_uuid(),
    'resourceType', 'organization',
    'effect', 'allow',
    'actions', '["UpdateOrgName", "UpdateOrgDefaultUserPermissions", "CreateOrg"]'::jsonb,
    'resources', '["organization/*"]'::jsonb
  )
)
WHERE id = '3e961f0f-6fd4-4cf4-910f-52d356f8cc08';