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
        createAt: new Date()
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
        updatedAt: null
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
        invitorId: null,
        initialPassword: null
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
        name: "frontend"
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
        secret: "MGU3LTNjNzUtNCUyMDIyMDkyNjAxMzgwNF9fNDZfXzkzX181N19fZGVmYXVsdF8zMDgwNw=="
    }
)
db.Environments.insertOne(
    {
        _id: "43b4f2be-356c-4a6e-a5f4-a30d1a25c9b7",
        projectId: "c0490315-0b90-4d9e-9c64-8c0bf9ea7944",
        name: "dev",
        description: "development environment",
        secret: "NzJlLTlkOGEtNCUyMDIyMDkyNjAxMzkyNF9fNDZfXzkzX181N19fZGVmYXVsdF9iYTA1NA=="
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
        updatedAt: null
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
        memberId: "a9013900-6c44-4aad-8e9a-568c2a429972"
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
        updatedAt: null
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
        policyId: "f8047349-8eb3-4553-a365-109b3582cd9a"
    }
)
print('collection seeded: GroupPolicies')