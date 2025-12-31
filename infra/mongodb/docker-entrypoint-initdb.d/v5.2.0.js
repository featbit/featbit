const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/811
db.Organizations.updateMany(
    {},
    {
        $set: {
            "settings.flagSortedBy": "created_at"
        }
    }
);

db.Policies.updateOne(
    {
        type: "SysManaged",
        name: "Administrator"
    },
    {
        $push: {
            "statements.$[org].actions": {
                $each: ["UpdateOrgSortFlagsBy"],
                $position: 0
            }
        }
    },
    {
        arrayFilters: [
            { "org.resourceType": "organization" }
        ]
    }
);