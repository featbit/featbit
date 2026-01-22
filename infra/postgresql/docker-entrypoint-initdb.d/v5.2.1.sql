-- https://github.com/featbit/featbit/pull/836
-- fix incorrect developer_policy_id

DO
$$
    DECLARE
        old_developer_policy_id UUID := '66f3687f-939f-4257-bd3f-c3553d39e1b6';
        new_developer_policy_id UUID := '66f3687f-939d-4257-bd3f-c3553d39e1b6';
    BEGIN
        -- 1. Update the id of the built-in developer policy
        UPDATE policies
        SET id = new_developer_policy_id
        WHERE id = old_developer_policy_id
          AND type = 'SysManaged'
          AND name = 'Developer';

        -- 2. Update organizations table - fix default_permissions jsonb
        UPDATE organizations
        SET default_permissions = jsonb_set(
                default_permissions,
                '{policyIds}',
                (
                    SELECT jsonb_agg(
                                   CASE
                                       WHEN elem::text = concat('"', old_developer_policy_id::text, '"')
                                           THEN to_jsonb(new_developer_policy_id::text)
                                       ELSE elem
                                       END
                           )
                    FROM jsonb_array_elements(default_permissions -> 'policyIds') AS elem
                )
            )
        WHERE default_permissions -> 'policyIds' @> to_jsonb(old_developer_policy_id::text);

        -- 3. Update member_policies table
        UPDATE member_policies
        SET policy_id = new_developer_policy_id
        WHERE policy_id = old_developer_policy_id;

        -- 4. Update group_policies table
        UPDATE group_policies
        SET policy_id = new_developer_policy_id
        WHERE policy_id = old_developer_policy_id;

    END
$$;

-- https://github.com/featbit/featbit/pull/841
-- added key to policies table
ALTER TABLE policies
    ADD COLUMN key varchar(128);

-- fill keys if null
UPDATE policies
SET key =
        regexp_replace(
                regexp_replace(
                        regexp_replace(
                                lower(trim(name)),
                                '[^\w\s-]', '', 'g'
                        ),
                        '[\s_-]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
        )
WHERE key IS NULL;

-- make sure keys are unique per organization
WITH ranked AS (
    SELECT
        id,
        organization_id,
        key,
        ROW_NUMBER() OVER (
            PARTITION BY organization_id, key
            ORDER BY created_at, id
            ) AS rn
    FROM policies
    WHERE key IS NOT NULL
)
UPDATE policies p
SET key = p.key || '-' || ranked.rn
FROM ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

-- make key not nullable
ALTER TABLE policies
    ALTER COLUMN key SET NOT NULL;

-- https://github.com/featbit/featbit/pull/844
-- added key to segments table
ALTER TABLE segments
    ADD COLUMN key varchar(128);

UPDATE segments
SET key =
        regexp_replace(
                regexp_replace(
                        regexp_replace(
                                lower(trim(name)),
                                '[^\w\s-]', '', 'g'
                        ),
                        '[\s_-]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
        )
WHERE key IS NULL;

WITH ranked AS (
    SELECT
        id,
        key,
        ROW_NUMBER() OVER (
            PARTITION BY
                CASE
                    WHEN type = 'shared' THEN workspace_id
                    WHEN type = 'environment-specific' THEN env_id
                    END,
                key
            ORDER BY created_at, id
            ) AS rn
    FROM segments
    WHERE key IS NOT NULL
      AND type IN ('shared', 'environment-specific')
)
UPDATE segments s
SET key = s.key || '-' || ranked.rn
FROM ranked
WHERE s.id = ranked.id
  AND ranked.rn > 1;

ALTER TABLE segments
    ALTER COLUMN key SET NOT NULL;