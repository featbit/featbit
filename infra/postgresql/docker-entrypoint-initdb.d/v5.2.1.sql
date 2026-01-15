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