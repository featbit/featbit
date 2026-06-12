const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/915
db.EndUsers.createIndex({envId: 1, updatedAt: -1, _id: -1});
db.EndUsers.createIndex({workspaceId: 1, updatedAt: -1, _id: -1});