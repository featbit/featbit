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
        name: "test-center",
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
