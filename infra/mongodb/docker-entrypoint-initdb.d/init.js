const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

print('seed started...')

// seed ids
const userId = UUID()
const organizationId = UUID()

// built-in policies
// see also: modules/back-end/src/Domain/Policies/BuiltInPolicy.cs
const ownerPolicyId = UUID("98881f6a-5c6c-4277-bcf7-fda94c538785")
const administratorPolicyId = UUID("3e961f0f-6fd4-4cf4-910f-52d356f8cc08")
const developerPolicyId = UUID("66f3687f-939d-4257-bd3f-c3553d39e1b6")

function getUUIDString() {
    return UUID().toString().split('"')[1];
}

// seed user
print('clean and seed collection: Users')
db.Users.deleteMany({})
db.Users.insertOne(
    {
        _id: userId,
        email: "test@featbit.com",
        password: "AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==",
        name: "tester",
        createAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: Users')

// seed organization
print('clean and seed collection: Organizations')
db.Organizations.deleteMany({})
db.Organizations.insertOne(
    {
        _id: organizationId,
        name: "playground",
        initialized: false,
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: Organizations')

// seed organization users
print('clean and seed collection: OrganizationUsers')
db.OrganizationUsers.deleteMany({})
db.OrganizationUsers.insertOne(
    {
        _id: UUID(),
        organizationId: organizationId,
        userId: userId,
        invitorId: null,
        initialPassword: "",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: OrganizationUsers')

// seed system managed policies
print('clean and seed collection: Policies')
db.Policies.deleteMany({})
db.Policies.insertOne(
    {
        _id: ownerPolicyId,
        organizationId: null,
        name: "Owner",
        description: "Contains all permissions. This policy is granted to the user who created the organization",
        type: "SysManaged",
        statements: [
            {
                _id: getUUIDString(),
                resourceType: "*",
                effect: "allow",
                actions: ["*"],
                resources: ["*"]
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
db.Policies.insertOne(
    {
        _id: administratorPolicyId,
        organizationId: null,
        name: "Administrator",
        description: "Contains all the permissions required by an administrator",
        type: "SysManaged",
        statements: [
            {
                _id: getUUIDString(),
                resourceType: "account",
                effect: "allow",
                actions: ["UpdateOrgName"],
                resources: ["account/*"]
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
                actions: [
                    "ManageServiceAccessTokens",
                    "ManagePersonalAccessTokens",
                    "ListAccessTokens"
                ],
                resources: ["access-token/*"]
            },
            {
                _id: getUUIDString(),
                resourceType: "project",
                effect: "allow",
                actions: [
                    "ListProjects",
                    "CreateProject",
                    "DeleteProject",
                    "UpdateProjectSettings",
                    "ListEnvs",
                    "CreateEnv"
                ],
                resources: ["project/*"]
            },
            {
                _id: getUUIDString(),
                resourceType: "env",
                effect: "allow",
                actions: [
                    "AccessEnvs",
                    "DeleteEnv",
                    "UpdateEnvSettings",
                    "CreateEnvSecret",
                    "DeleteEnvSecret",
                    "UpdateEnvSecret"
                ],
                resources: ["project/*:env/*"]
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
db.Policies.insertOne(
    {
        _id: developerPolicyId,
        organizationId: null,
        name: "Developer",
        description: "Contains all the permissions required by a developer",
        type: "SysManaged",
        statements: [
            {
                _id: getUUIDString(),
                resourceType: "access-token",
                effect: "allow",
                actions: [
                    "ManageServiceAccessTokens",
                    "ManagePersonalAccessTokens",
                    "ListAccessTokens"
                ],
                resources: ["access-token/*"]
            },
            {
                _id: getUUIDString(),
                resourceType: "project",
                effect: "allow",
                actions: [
                    "ListProjects",
                    "ListEnvs"
                ],
                resources: ["project/*"]
            },
            {
                _id: getUUIDString(),
                resourceType: "env",
                effect: "allow",
                actions: [
                    "AccessEnvs"
                ],
                resources: ["project/*:env/*"]
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: Policies')

// seed member policy
print('clean and seed collection: MemberPolicies')
db.MemberPolicies.deleteMany({})
db.MemberPolicies.insertOne(
    {
        _id: UUID(),
        organizationId: organizationId,
        policyId: ownerPolicyId,
        memberId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: MemberPolicies')
