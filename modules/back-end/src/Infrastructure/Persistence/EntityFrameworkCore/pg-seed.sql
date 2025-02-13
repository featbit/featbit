-- seed started
DO $$ 
DECLARE
    workspace_id UUID := gen_random_uuid();
    user_id UUID := gen_random_uuid();
    organization_id UUID := gen_random_uuid();
    -- Built-in policies
    owner_policy_id UUID := '98881f6a-5c6c-4277-bcf7-fda94c538785';
    administrator_policy_id UUID := '3e961f0f-6fd4-4cf4-910f-52d356f8cc08';
    developer_policy_id UUID := '66f3687f-939f-4257-bd3f-c3553d39e1b6';
BEGIN
    -- empty tables
    TRUNCATE TABLE "Workspaces" CASCADE;
    TRUNCATE TABLE "Users" CASCADE;
    TRUNCATE TABLE "Organizations" CASCADE;
    TRUNCATE TABLE "OrganizationUsers" CASCADE;
    TRUNCATE TABLE "Policies" CASCADE;
    TRUNCATE TABLE "MemberPolicies" CASCADE;

    -- seed workspace
    INSERT INTO "Workspaces" (_id, name, key, sso, license, "createdAt", "updatedAt")
    VALUES (workspace_id, 'Default Workspace', 'default-workspace', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- seed user
    INSERT INTO "Users" (_id, email, password, name, origin, "workspaceId", "createAt", "updatedAt")
    VALUES (user_id, 'test@featbit.com', 'AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==',
            'tester', 'Local', workspace_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- seed organization
    INSERT INTO "Organizations" (_id, "workspaceId", name, key, initialized, "createdAt", "updatedAt")
    VALUES (organization_id, workspace_id, 'playground', 'playground', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- seed organization users
    INSERT INTO "OrganizationUsers" (_id, "organizationId", "userId", "invitorId", "initialPassword", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), organization_id, user_id, NULL, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- seed system managed policies
    INSERT INTO "Policies" (_id, "organizationId", name, description, type, statements, "createdAt", "updatedAt")
    VALUES
        (owner_policy_id, NULL, 'Owner', 
         'Contains all permissions. This policy is granted to the user who created the organization',
         'SysManaged',
         jsonb_build_array(
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', '*',
                 'effect', 'allow',
                 'actions', ARRAY['*'],
                 'resources', ARRAY['*']
             )
         ),
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        
        (administrator_policy_id, NULL, 'Administrator',
         'Contains all the permissions required by an administrator',
         'SysManaged',
         jsonb_build_array(
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'organization',
                 'effect', 'allow',
                 'actions', ARRAY['UpdateOrgName'],
                 'resources', ARRAY['organization/*']
             ),
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'iam',
                 'effect', 'allow',
                 'actions', ARRAY['CanManageIAM'],
                 'resources', ARRAY['iam/*']
             ),
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'access-token',
                 'effect', 'allow',
                 'actions', ARRAY['ManageServiceAccessTokens', 'ManagePersonalAccessTokens', 'ListAccessTokens'],
                 'resources', ARRAY['access-token/*']
             ),
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'relay-proxy',
                 'effect', 'allow',
                 'actions', ARRAY['ManageRelayProxies', 'ListRelayProxies'],
                 'resources', ARRAY['relay-proxy/*']
             ),
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'project',
                 'effect', 'allow',
                 'actions', ARRAY['CanAccessProject', 'CreateProject', 'DeleteProject', 'UpdateProjectSettings', 'CreateEnv'],
                 'resources', ARRAY['project/*']
             ),
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'env',
                 'effect', 'allow',
                 'actions', ARRAY['DeleteEnv', 'UpdateEnvSettings', 'CreateEnvSecret', 'DeleteEnvSecret', 'UpdateEnvSecret'],
                 'resources', ARRAY['project/*:env/*']
             )
         ),
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        
        (developer_policy_id, NULL, 'Developer',
         'Contains all the permissions required by a developer',
         'SysManaged',
         jsonb_build_array(
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'access-token',
                 'effect', 'allow',
                 'actions', ARRAY['ManageServiceAccessTokens', 'ManagePersonalAccessTokens', 'ListAccessTokens'],
                 'resources', ARRAY['access-token/*']
             ),
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'relay-proxy',
                 'effect', 'allow',
                 'actions', ARRAY['ManageRelayProxies', 'ListRelayProxies'],
                 'resources', ARRAY['relay-proxy/*']
             ),
             jsonb_build_object(
                 '_id', gen_random_uuid(),
                 'resourceType', 'project',
                 'effect', 'allow',
                 'actions', ARRAY['CanAccessProject'],
                 'resources', ARRAY['project/*']
             )
         ),
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    -- seed member policy
    INSERT INTO "MemberPolicies" (_id, "organizationId", "policyId", "memberId", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), organization_id, owner_policy_id, user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

END $$;