\connect featbit

-- https://github.com/featbit/featbit/pull/802

alter table segments
    add column tags text[] default array []::text[];

-- https://github.com/featbit/featbit/pull/811

alter table organizations
    add column settings jsonb not null default '{}';

UPDATE policies policy
SET statements = (
    SELECT jsonb_agg(
                   CASE
                       WHEN elem->>'resourceType' = 'organization' THEN
                           jsonb_set(
                                   elem,
                                   '{actions}',
                                   ('["UpdateOrgSortFlagsBy"]'::jsonb || (elem->'actions')::jsonb)
                           )
                       ELSE
                           elem
                       END
           )
    FROM jsonb_array_elements(policy.statements) AS elem
)
WHERE policy.type = 'SysManaged' AND policy.name = 'Administrator';

-- https://github.com/featbit/featbit/pull/821

UPDATE policies
SET statements =
        (SELECT jsonb_agg(
                        CASE
                            WHEN stmt ->> 'resourceType' = 'flag'
                                AND stmt -> 'actions' ? 'ManageFeatureFlag'
                                THEN
                                jsonb_set(
                                        stmt,
                                        '{actions}',
                                        '["*"]'::jsonb,
                                        false
                                )
                            ELSE
                                stmt
                            END
                )
         FROM jsonb_array_elements(statements) AS stmt)
WHERE statements @> '[{"resourceType":"flag"}]';

UPDATE access_tokens
SET permissions =
        (SELECT jsonb_agg(
                        CASE
                            WHEN stmt ->> 'resourceType' = 'flag'
                                AND stmt -> 'actions' ? 'ManageFeatureFlag'
                                THEN
                                jsonb_set(
                                        stmt,
                                        '{actions}',
                                        '["*"]'::jsonb,
                                        false
                                )
                            ELSE
                                stmt
                            END
                )
         FROM jsonb_array_elements(permissions) AS stmt)
WHERE permissions @> '[{"resourceType":"flag"}]';

-- update built-in 'Administrator' and 'Developer' policies to ensure they have full access to feature flags
UPDATE policies policy
SET statements = COALESCE(policy.statements, '[]'::jsonb) ||
                 jsonb_build_array(
                         jsonb_build_object(
                                 'id', gen_random_uuid(),
                                 'resourceType', 'flag',
                                 'effect', 'allow',
                                 'actions', ARRAY ['*'],
                                 'resources', ARRAY ['project/*:env/*:flag/*']
                         )
                 )
WHERE policy.organization_id IS NULL
  AND policy.type = 'SysManaged'
  AND policy.name IN ('Administrator', 'Developer')
  AND NOT EXISTS (SELECT 1
                  FROM jsonb_array_elements(COALESCE(policy.statements, '[]'::jsonb)) s
                  WHERE s ->> 'resourceType' = 'flag');
