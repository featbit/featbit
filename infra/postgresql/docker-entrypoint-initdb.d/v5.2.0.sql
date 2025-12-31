\connect featbit

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