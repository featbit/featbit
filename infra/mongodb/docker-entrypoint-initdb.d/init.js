const dbName = "featbit";
const db = db.getSiblingDB(dbName);

// Constants
const IDS = {
    workspace: UUID(),
    user: UUID(),
    organization: UUID(),
    policies: {
        owner: UUID("98881f6a-5c6c-4277-bcf7-fda94c538785"),
        admin: UUID("3e961f0f-6fd4-4cf4-910f-52d356f8cc08"),
        dev: UUID("66f3687f-939d-4257-bd3f-c3553d39e1b6")
    }
};

const getUUIDString = () => UUID().toString().split('"')[1];

// Batch operations array
const operations = [
    {
        collection: 'Workspaces',
        data: [{
            _id: IDS.workspace,
            name: "Default Workspace",
            key: "default-workspace",
            sso: null,
            license: null,
            createdAt: new Date(),
            updatedAt: new Date()
        }]
    },
    {
        collection: 'Users',
        data: [{
            _id: IDS.user,
            email: "test@featbit.com",
            password: "AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==",
            name: "tester",
            origin: "Local",
            workspaceId: IDS.workspace,
            createAt: new Date(),
            updatedAt: new Date()
        }]
    },
    {
        collection: 'Organizations',
        data: [{
            _id: IDS.organization,
            workspaceId: IDS.workspace,
            name: "playground",
            key: "playground",
            initialized: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }]
    },
    {
        collection: 'OrganizationUsers',
        data: [{
            _id: UUID(),
            organizationId: IDS.organization,
            userId: IDS.user,
            invitorId: null,
            initialPassword: "",
            createdAt: new Date(),
            updatedAt: new Date()
        }]
    },
    {
        collection: 'Policies',
        data: [
            {
                _id: IDS.policies.owner,
                organizationId: null,
                name: "Owner",
                description: "Contains all permissions. This policy is granted to the user who created the organization",
                type: "SysManaged",
                statements: [{
                    _id: getUUIDString(),
                    resourceType: "*",
                    effect: "allow",
                    actions: ["*"],
                    resources: ["*"]
                }],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: IDS.policies.admin,
                organizationId: null,
                name: "Administrator",
                description: "Contains all the permissions required by an administrator",
                type: "SysManaged",
                statements: [
                    {
                        _id: getUUIDString(),
                        resourceType: "organization",
                        effect: "allow",
                        actions: ["UpdateOrgName"],
                        resources: ["organization/*"]
                    },
                    {
                        _id: getUUIDString(),
                        resourceType: "iam",
                        effect: "allow",
                        actions: ["CanManageIAM"],
                        resources: ["iam/*"]
                    },
                    {
                        _id: getUUIDString(),
                        resourceType: "access-token",
                        effect: "allow",
                        actions: ["ManageServiceAccessTokens", "ManagePersonalAccessTokens", "ListAccessTokens"],
                        resources: ["access-token/*"]
                    },
                    {
                        _id: getUUIDString(),
                        resourceType: "relay-proxy",
                        effect: "allow",
                        actions: ["ManageRelayProxies", "ListRelayProxies"],
                        resources: ["relay-proxy/*"]
                    },
                    {
                        _id: getUUIDString(),
                        resourceType: "project",
                        effect: "allow",
                        actions: ["CanAccessProject", "CreateProject", "DeleteProject", "UpdateProjectSettings", "CreateEnv"],
                        resources: ["project/*"]
                    },
                    {
                        _id: getUUIDString(),
                        resourceType: "env",
                        effect: "allow",
                        actions: ["DeleteEnv", "UpdateEnvSettings", "CreateEnvSecret", "DeleteEnvSecret", "UpdateEnvSecret"],
                        resources: ["project/*:env/*"]
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                _id: IDS.policies.dev,
                organizationId: null,
                name: "Developer",
                description: "Contains all the permissions required by a developer",
                type: "SysManaged",
                statements: [
                    {
                        _id: getUUIDString(),
                        resourceType: "access-token",
                        effect: "allow",
                        actions: ["ManageServiceAccessTokens", "ManagePersonalAccessTokens", "ListAccessTokens"],
                        resources: ["access-token/*"]
                    },
                    {
                        _id: getUUIDString(),
                        resourceType: "relay-proxy",
                        effect: "allow",
                        actions: ["ManageRelayProxies", "ListRelayProxies"],
                        resources: ["relay-proxy/*"]
                    },
                    {
                        _id: getUUIDString(),
                        resourceType: "project",
                        effect: "allow",
                        actions: ["CanAccessProject"],
                        resources: ["project/*"]
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]
    },
    {
        collection: 'MemberPolicies',
        data: [{
            _id: UUID(),
            organizationId: IDS.organization,
            policyId: IDS.policies.owner,
            memberId: IDS.user,
            createdAt: new Date(),
            updatedAt: new Date()
        }]
    }
];

// Execute batch operations
operations.forEach(op => {
    db[op.collection].deleteMany({});
    db[op.collection].insertMany(op.data);
});

// Create indexes in batch
const indexes = {
    'AuditLogs': { createdAt: 1 },
    'EndUsers': { updatedAt: 1 },
    'ExperimentMetrics': { updatedAt: 1 },
    'FeatureFlags': { updatedAt: 1 },
    'Segments': { updatedAt: 1 },
    'AccessTokens': { createdAt: 1 },
    'Policies': { createdAt: 1 },
    'Projects': { createdAt: 1 },
    'RelayProxies': { createdAt: 1 },
    'Webhooks': [
        { createdAt: 1 },
        { startedAt: 1 }
    ]
};

Object.entries(indexes).forEach(([collection, index]) => {
    if (Array.isArray(index)) {
        index.forEach(idx => db[collection].createIndex(idx));
    } else {
        db[collection].createIndex(index);
    }
});