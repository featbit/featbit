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
