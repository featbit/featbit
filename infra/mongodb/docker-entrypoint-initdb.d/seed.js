print('use featbit database')
db = db.getSiblingDB('featbit')

print('seed started...')

// seed ids
const userId = UUID("4526975f-4f6b-4420-9dde-84c276148832")
const organizationId = UUID("67e2b2db-01ec-4725-9fd9-e5cc3d3a6b74")
const projectId = UUID("5a2eaddd-34fb-4d59-831a-bd7fe427b802")

const groupId = UUID("4dbea94d-a1cb-45e3-bab7-c5bf8f956f44")
const ownerPolicyId = UUID("98881f6a-5c6c-4277-bcf7-fda94c538785")
const administratorPolicyId = UUID("3e961f0f-6fd4-4cf4-910f-52d356f8cc08")
const developerPolicyId = UUID("66f3687f-939d-4257-bd3f-c3553d39e1b6")
const testerPolicyId = UUID("65244ccc-d336-44b2-b4ee-b24482ea6037")

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
        initialized: true,
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

// seed project
print('clean and seed collection: Projects')
db.Projects.deleteMany({})
db.Projects.insertOne(
    {
        _id: projectId,
        organizationId: organizationId,
        name: "frontend",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: Projects')

// seed environments
print('clean and seed collection: Environments')
db.Environments.deleteMany({})
db.Environments.insertOne(
    {
        _id: UUID(),
        projectId: projectId,
        name: "Prod",
        description: "Production environment",
        secret: "MGU3LTNjNzUtNCUyMDIyMDkyNjAxMzgwNF9fNDZfXzkzX181N19fZGVmYXVsdF8zMDgwNw==",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
db.Environments.insertOne(
    {
        _id: UUID(),
        projectId: projectId,
        name: "Dev",
        description: "Development environment",
        secret: "NzJlLTlkOGEtNCUyMDIyMDkyNjAxMzkyNF9fNDZfXzkzX181N19fZGVmYXVsdF9iYTA1NA==",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: Environments')

// seed group
print('clean and seed collection: Groups')
db.Groups.deleteMany({})
db.Groups.insertOne(
    {
        _id: groupId,
        organizationId: organizationId,
        name: "tester-group",
        description: "a group for all testers",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: Groups')

// seed group member
print('clean and seed collection: GroupMembers')
db.GroupMembers.deleteMany({})
db.GroupMembers.insertOne(
    {
        _id: UUID(),
        groupId: groupId,
        organizationId: organizationId,
        memberId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: GroupMembers')

// seed policy
print('clean and seed collection: Policies')
db.Policies.deleteMany({})
db.Policies.insertOne(
    {
        _id: testerPolicyId,
        organizationId: organizationId,
        name: "tester-policy",
        description: "a policy for all testers",
        type: "CustomerManaged",
        statements: [],
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
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

// seed group policy
print('clean and seed collection: GroupPolicies')
db.GroupPolicies.deleteMany({})
db.GroupPolicies.insertOne(
    {
        _id: UUID(),
        groupId: groupId,
        policyId: testerPolicyId,
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: GroupPolicies')

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
print('collection seeded: GroupPolicies')