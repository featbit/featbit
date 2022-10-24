print('use featbit database')
db = db.getSiblingDB('featbit')

print('seed started...')

// seed ids
const userId = UUID("4526975f-4f6b-4420-9dde-84c276148832")
const organizationId = UUID("67e2b2db-01ec-4725-9fd9-e5cc3d3a6b74")
const ownerPolicyId = UUID("98881f6a-5c6c-4277-bcf7-fda94c538785")
const administratorPolicyId = UUID("3e961f0f-6fd4-4cf4-910f-52d356f8cc08")
const developerPolicyId = UUID("66f3687f-939d-4257-bd3f-c3553d39e1b6")

// seed user
print('clean and seed collection: Users')
db.Users.deleteMany({})
db.Users.insertOne(
    {
        _id: userId,
        email: "test@featbit.com",
        password: "AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==",
        name: "",
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
                _id: "754a689a-3280-4769-b312-10958718402f",
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
                _id: "f73fa469-a97e-465d-8d6f-3f53bf4fe290",
                resourceType: "general",
                effect: "allow",
                actions: ["CanManageIAM"],
                resources: ["iam"]
            },
            {
                _id: "ba619151-0504-4deb-8341-e2db0ea99407",
                resourceType: "general",
                effect: "allow",
                actions: ["UpdateOrgName"],
                resources: ["account"]
            },
            {
                _id: "6164bebe-756e-4021-9e5b-f7e497ab893b",
                resourceType: "general",
                effect: "allow",
                actions: [
                    "ListProjects",
                    "CreateProject",
                    "DeleteProject",
                    "AccessEnvs",
                    "UpdateProjectInfo",
                    "ListEnvs",
                    "CreateEnv",
                    "DeleteEnv",
                    "UpdateEnvInfo"
                ],
                resources: ["project"]
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
                _id: "a53eb0a6-9056-4932-b5db-f34cbcf7bdb7",
                resourceType: "general",
                effect: "allow",
                actions: [
                    "AccessEnvs",
                    "ListProjects",
                    "ListEnvs"
                ],
                resources: ["project"]
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: Policies')