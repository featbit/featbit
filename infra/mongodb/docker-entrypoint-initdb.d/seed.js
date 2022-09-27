print('use featbit database')
db = db.getSiblingDB('featbit')

print('seed started...')

// seed user
print('clean and seed collection: Users')
db.Users.deleteMany({})
db.Users.insertOne(
    {
        _id: "a9013900-6c44-4aad-8e9a-568c2a429972",
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
        _id: "c3290506-9ddb-4b58-96ae-5594f7937610",
        name: "playground",
        initialized: true,
        subscription: {
            _id: "b0f6d1a0-b7c7-402f-9992-f10bc3696665",
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
        _id: "8bb885ec-2b68-4b07-894d-daacfb451743",
        organizationId: "c3290506-9ddb-4b58-96ae-5594f7937610",
        userId: "a9013900-6c44-4aad-8e9a-568c2a429972",
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
        _id: "c0490315-0b90-4d9e-9c64-8c0bf9ea7944",
        organizationId: "c3290506-9ddb-4b58-96ae-5594f7937610",
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
        _id: "8bb885ec-2b68-4b07-894d-daacfb451743",
        projectId: "c0490315-0b90-4d9e-9c64-8c0bf9ea7944",
        name: "prod",
        description: "production environment",
        secret: "MGU3LTNjNzUtNCUyMDIyMDkyNjAxMzgwNF9fNDZfXzkzX181N19fZGVmYXVsdF8zMDgwNw==",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
db.Environments.insertOne(
    {
        _id: "43b4f2be-356c-4a6e-a5f4-a30d1a25c9b7",
        projectId: "c0490315-0b90-4d9e-9c64-8c0bf9ea7944",
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
        _id: "92a0de88-899e-4bea-8668-1ad43b45f33d",
        organizationId: "c3290506-9ddb-4b58-96ae-5594f7937610",
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
        _id: "87e0da87-1d90-40d0-9412-df3b8a8fe703",
        groupId: "92a0de88-899e-4bea-8668-1ad43b45f33d",
        organizationId: "c3290506-9ddb-4b58-96ae-5594f7937610",
        memberId: "a9013900-6c44-4aad-8e9a-568c2a429972",
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
        _id: "f8047349-8eb3-4553-a365-109b3582cd9a",
        organizationId: "c3290506-9ddb-4b58-96ae-5594f7937610",
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
        _id: "f8047349-8eb3-4553-a365-109b3582cd9b",
        organizationId: null,
        name: "Organization owner",
        description: "Includes all permissions, the policy is granted to the user who created the organization",
        type: "SysManaged",
        statements: [
            {
              _id: "452ec8b2-c4ae-443d-a8a7-4307e4f5cf97",
              resourceType: "*",
              effect: "allow",
              actions: [
                "*"
              ],
              resources: [
                "*"
              ]
            }
          ],
        createdAt: new Date(),
        updatedAt: new Date()
    }
)

db.Policies.insertOne(
    {
        _id: "9af529cb-38b7-490e-98ae-e6ace2e83b05",
        organizationId: null,
        name: "Admin",
        description: "Includes all permissions needed for an system administrator",
        type: "SysManaged",
        statements: [
            {
              _id: "d0c1d3c7-298c-4d09-bc33-e26ee5783c64",
              resourceType: "general",
              effect: "allow",
              actions: [
                "CanManageIAM"
              ],
              resources: [
                "iam"
              ]
            },
            {
              _id: "5327d9c5-7a67-452d-9f00-fd0fdb8aaca2",
              resourceType: "general",
              effect: "allow",
              actions: [
                "UpdateOrgName"
              ],
              resources: [
                "account"
              ]
            },
            {
              _id: "846dd70c-9076-4478-a85c-3a0d19fe2ef0",
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
              resources: [
                "project"
              ]
            }
          ],
        createdAt: new Date(),
        updatedAt: new Date()
    }
)

db.Policies.insertOne(
    {
        _id: "f8047349-8eb3-4553-a365-109b3582cd9c",
        organizationId: null,
        name: "Developer",
        description: "Includes all permissions needed for an developer",
        type: "SysManaged",
        statements: [
            {
              _id: "2df9f848-b754-42af-8402-8930dae3a934",
              resourceType: "general",
              effect: "allow",
              actions: [
                "AccessEnvs",
                "ListProjects",
                "ListEnvs"
              ],
              resources: [
                "project"
              ]
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
        _id: "29d60a1e-aca3-4160-8876-557c3d6d4d2e",
        groupId: "92a0de88-899e-4bea-8668-1ad43b45f33d",
        policyId: "f8047349-8eb3-4553-a365-109b3582cd9a",
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
        _id: "29d60a1e-aca3-4160-8876-557c3d6d4d11",
        organizationId: "c3290506-9ddb-4b58-96ae-5594f7937610",
        policyId: "f8047349-8eb3-4553-a365-109b3582cd9b",
        memberId: "a9013900-6c44-4aad-8e9a-568c2a429972",
        createdAt: new Date(),
        updatedAt: new Date()
    }
)
print('collection seeded: GroupPolicies')