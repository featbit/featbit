print('use featbit database')
db = db.getSiblingDB('featbit')

print('seed started...')

// seed ids
const userId = ObjectId("6333a33c315364eead14253d");

const organizationId = ObjectId("6333a34a315364eead14253e");
const projectId = ObjectId("6333a351315364eead14253f");

const groupId = ObjectId("6333a358315364eead142540");
const ownerPolicyId = ObjectId("6333a360315364eead142541");
const administratorPolicyId = ObjectId("6333a37b315364eead142542");
const developerPolicyId = ObjectId("6333a382315364eead142543");
const testerPolicyId = ObjectId("6333a38e315364eead142544");

// seed user
print('clean and seed collection: Users')
db.Users.deleteMany({})
db.Users.insertOne(
    {
        _id: userId,
        email: "test@featbit.com",
        password: "AQAAAAEAACcQAAAAELDHEjCrDQrmnAXU5C//mOLvUBJ7lnVFEMMFxNMDIIrF7xK8JDQKUifU3HH4gexNAQ==",
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
        subscription: {
            _id: ObjectId(),
            type: "L100"
        },
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
        _id: ObjectId(),
        organizationId: organizationId,
        userId: userId,
        invitorId: "",
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
        _id: ObjectId(),
        projectId: projectId,
        name: "prod",
        description: "production environment",
        secret: "MGU3LTNjNzUtNCUyMDIyMDkyNjAxMzgwNF9fNDZfXzkzX181N19fZGVmYXVsdF8zMDgwNw==",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
db.Environments.insertOne(
    {
        _id: ObjectId(),
        projectId: projectId,
        name: "dev",
        description: "development environment",
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
        _id: ObjectId(),
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
        organizationId: "",
        name: "Owner",
        description: "Contains all permissions. This policy is granted to the user who created the organization",
        type: "SysManaged",
        statements: [
            {
                _id: ObjectId(),
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
        organizationId: "",
        name: "Administrator",
        description: "Contains all the permissions required by a administrator",
        type: "SysManaged",
        statements: [
            {
                _id: ObjectId(),
                resourceType: "general",
                effect: "allow",
                actions: ["CanManageIAM"],
                resources: ["iam"]
            },
            {
                _id: ObjectId(),
                resourceType: "general",
                effect: "allow",
                actions: ["UpdateOrgName"],
                resources: ["account"]
            },
            {
                _id: ObjectId(),
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
        organizationId: "",
        name: "Developer",
        description: "Contains all the permissions required by a developer",
        type: "SysManaged",
        statements: [
            {
                _id: ObjectId(),
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
        _id: ObjectId(),
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
        _id: ObjectId(),
        organizationId: organizationId,
        policyId: ownerPolicyId,
        memberId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: GroupPolicies')