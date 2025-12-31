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

// https://github.com/featbit/featbit/pull/821

db.Policies.updateMany(
    {
        "statements.resourceType": "flag",
        "statements.actions": "ManageFeatureFlag"
    },
    {
        $set: {
            "statements.$[stmt].actions": ["*"]
        }
    },
    {
        arrayFilters: [
            {
                "stmt.resourceType": "flag",
                "stmt.actions": "ManageFeatureFlag"
            }
        ]
    }
)

db.AccessTokens.updateMany(
    {
        "permissions.resourceType": "flag",
        "permissions.actions": "ManageFeatureFlag"
    },
    {
        $set: {
            "permissions.$[perm].actions": ["*"]
        }
    },
    {
        arrayFilters: [
            {
                "perm.resourceType": "flag",
                "perm.actions": "ManageFeatureFlag"
            }
        ]
    }
);