\connect featbit

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
-- truncate tables
TRUNCATE TABLE workspaces CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE organizations CASCADE;
TRUNCATE TABLE organization_users CASCADE;
TRUNCATE TABLE policies CASCADE;
TRUNCATE TABLE member_policies CASCADE;

-- seed workspace
INSERT INTO workspaces (id, name, key, sso, license, created_at, updated_at)
VALUES (workspace_id, 'Default Workspace', 'default-workspace', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed user
INSERT INTO users (id, email, password, name, origin, workspace_id, created_at, updated_at)
VALUES (user_id, 'test@featbit.com', 'AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==',
        'tester', 'Local', workspace_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed organization
INSERT INTO organizations (id, workspace_id, name, key, initialized, default_permissions, created_at, updated_at)
VALUES (organization_id, workspace_id, 'playground', 'playground', false,
        jsonb_build_object('policyIds', jsonb_build_array(developer_policy_id), 'groupIds', jsonb_build_array()),
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed organization users
INSERT INTO organization_users (id, organization_id, user_id, invitor_id, initial_password, created_at, updated_at)
VALUES (gen_random_uuid(), organization_id, user_id, NULL, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed system managed policies
INSERT INTO policies (id, organization_id, name, description, type, statements, created_at, updated_at)
VALUES
    (owner_policy_id, NULL, 'Owner',
     'Contains all permissions. This policy is granted to the user who created the organization',
     'SysManaged',
     jsonb_build_array(
             jsonb_build_object(
                     'id', gen_random_uuid(),
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
                     'id', gen_random_uuid(),
                     'resourceType', 'organization',
                     'effect', 'allow',
                     'actions', ARRAY['UpdateOrgName'],
                     'resources', ARRAY['organization/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
                     'resourceType', 'organization',
                     'effect', 'allow',
                     'actions', ARRAY['UpdateOrgDefaultUserPermissions'],
                     'resources', ARRAY['organization/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
                     'resourceType', 'iam',
                     'effect', 'allow',
                     'actions', ARRAY['CanManageIAM'],
                     'resources', ARRAY['iam/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
                     'resourceType', 'access-token',
                     'effect', 'allow',
                     'actions', ARRAY['ManageServiceAccessTokens', 'ManagePersonalAccessTokens', 'ListAccessTokens'],
                     'resources', ARRAY['access-token/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
                     'resourceType', 'relay-proxy',
                     'effect', 'allow',
                     'actions', ARRAY['ManageRelayProxies', 'ListRelayProxies'],
                     'resources', ARRAY['relay-proxy/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
                     'resourceType', 'project',
                     'effect', 'allow',
                     'actions', ARRAY['CanAccessProject', 'CreateProject', 'DeleteProject', 'UpdateProjectSettings', 'CreateEnv'],
                     'resources', ARRAY['project/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
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
                     'id', gen_random_uuid(),
                     'resourceType', 'access-token',
                     'effect', 'allow',
                     'actions', ARRAY['ManageServiceAccessTokens', 'ManagePersonalAccessTokens', 'ListAccessTokens'],
                     'resources', ARRAY['access-token/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
                     'resourceType', 'relay-proxy',
                     'effect', 'allow',
                     'actions', ARRAY['ManageRelayProxies', 'ListRelayProxies'],
                     'resources', ARRAY['relay-proxy/*']
             ),
             jsonb_build_object(
                     'id', gen_random_uuid(),
                     'resourceType', 'project',
                     'effect', 'allow',
                     'actions', ARRAY['CanAccessProject'],
                     'resources', ARRAY['project/*']
             )
     ),
     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- seed member policy
INSERT INTO member_policies (id, organization_id, policy_id, member_id, created_at, updated_at)
VALUES (gen_random_uuid(), organization_id, owner_policy_id, user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

END $$;