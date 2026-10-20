const dbName = "featbit";
db = db.getSiblingDB(dbName);

// Preserve each allow statement's scope; leave deny statements unchanged.
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
