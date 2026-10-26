const dbName = "featbit";
db = db.getSiblingDB(dbName);

// https://github.com/featbit/featbit/pull/1022
// ViewEnvSecret is independent at runtime. Preserve existing secret managers'
// access and grant the built-in Developer read access for SDK integration.
db.Policies.find({ "statements.resourceType": "env" }).forEach(policy => {
    let changed = false;
    const statements = policy.statements.map(statement => {
        const actions = statement.actions || [];
        const managesSecrets = actions.some(action =>
            ["CreateEnvSecret", "UpdateEnvSecret", "DeleteEnvSecret"].includes(action));
        const isDeveloper = policy.type === "SysManaged" && policy.organizationId == null
            && policy.name === "Developer" && actions.includes("CanAccessEnv");
        if (statement.effect === "allow" && statement.resourceType === "env"
            && !actions.includes("ViewEnvSecret") && !actions.includes("*")
            && (managesSecrets || isDeveloper)) {
            changed = true;
            return { ...statement, actions: [...actions, "ViewEnvSecret"] };
        }
        return statement;
    });
    if (changed) {
        db.Policies.updateOne({ _id: policy._id }, { $set: { statements } });
    }
});

// Service tokens store their own permissions rather than inheriting policies.
db.AccessTokens.find({ type: "Service", "permissions.resourceType": "env" }).forEach(token => {
    let changed = false;
    const permissions = token.permissions.map(statement => {
        const actions = statement.actions || [];
        const managesSecrets = actions.some(action =>
            ["CreateEnvSecret", "UpdateEnvSecret", "DeleteEnvSecret"].includes(action));
        if (statement.effect === "allow" && statement.resourceType === "env"
            && !actions.includes("ViewEnvSecret") && !actions.includes("*")
            && managesSecrets) {
            changed = true;
            return { ...statement, actions: [...actions, "ViewEnvSecret"] };
        }
        return statement;
    });
    if (changed) {
        db.AccessTokens.updateOne({ _id: token._id }, { $set: { permissions } });
    }
});

// https://github.com/featbit/featbit/pull/1038
// Backfill workspace_id and organization_id for audit logs.
db.AuditLogs.aggregate([
    { $match: { workspaceId: null } },
    {
        $lookup: {
            from: "Environments",
            localField: "envId",
            foreignField: "_id",
            as: "environment"
        }
    },
    { $unwind: "$environment" },
    {
        $lookup: {
            from: "Projects",
            localField: "environment.projectId",
            foreignField: "_id",
            as: "project"
        }
    },
    { $unwind: "$project" },
    {
        $lookup: {
            from: "Organizations",
            localField: "project.organizationId",
            foreignField: "_id",
            as: "organization"
        }
    },
    { $unwind: "$organization" },
    {
        $project: {
            _id: 1,
            workspaceId: "$organization.workspaceId",
            organizationId: "$organization._id"
        }
    },
    {
        $merge: {
            into: "AuditLogs",
            on: "_id",
            whenMatched: "merge",
            whenNotMatched: "discard"
        }
    }
]);

if (db.AuditLogs.getIndexes().some(index => index.name === "createdAt_1")) {
    db.AuditLogs.dropIndex("createdAt_1");
}

db.AuditLogs.createIndex(
    { workspaceId: 1, envId: 1, createdAt: -1, _id: -1 }
);
db.AuditLogs.createIndex(
    { workspaceId: 1, organizationId: 1, createdAt: -1, _id: -1 }
);
db.AuditLogs.createIndex(
    { workspaceId: 1, refType: 1, refId: 1, createdAt: -1, _id: -1 }
);
