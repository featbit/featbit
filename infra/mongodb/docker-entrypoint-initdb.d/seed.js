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