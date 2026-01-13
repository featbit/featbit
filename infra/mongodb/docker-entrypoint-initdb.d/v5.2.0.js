const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/802

db.Segments.updateMany(
    { tags: { $exists: false } },
    { $set: { tags: [] } }
);

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

// update built-in 'Administrator' and 'Developer' policies

// add access to envs for 'Developer' policy
db.Policies.updateOne(
    {
        organizationId: { $eq: null },
        type: "SysManaged",
        name: "Developer",
        "statements.resourceType": { $ne: "env" }
    },
    {
        $push: {
            statements: {
                id: UUID().toString().split('"')[1],
                resourceType: "env",
                effect: "allow",
                actions: ["CanAccessEnv"],
                resources: ["project/*:env/*"]
            }
        }
    }
);

// add access to envs for 'Administrator' policy
db.Policies.updateOne(
    {
        organizationId: { $eq: null },
        type: "SysManaged",
        name: "Administrator"
    },
    {
        $set: {
            "statements.$[stmt].actions": ["CanAccessEnv", "DeleteEnv", "UpdateEnvSettings", "CreateEnvSecret", "DeleteEnvSecret", "UpdateEnvSecret"]
        }
    },
    {
        arrayFilters: [
            { "stmt.resourceType": "env" }
        ]
    }
);

// add full access to feature flags
db.Policies.updateMany(
    {
        organizationId: { $eq: null },
        type: "SysManaged",
        name: { $in: ["Administrator", "Developer"] },
        "statements.resourceType": { $ne: "flag" }
    },
    {
        $push: {
            statements: {
                id: UUID(),
                resourceType: "flag",
                effect: "allow",
                actions: ["*"],
                resources: ["project/*:env/*:flag/*"]
            }
        }
    }
);

