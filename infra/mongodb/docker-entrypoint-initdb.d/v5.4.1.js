const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

db.EndUsers.createIndex({envId: 1, updatedAt: -1, _id: -1})
db.EndUsers.createIndex({workspaceId: 1, updatedAt: -1, _id: -1})