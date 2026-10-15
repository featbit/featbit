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
