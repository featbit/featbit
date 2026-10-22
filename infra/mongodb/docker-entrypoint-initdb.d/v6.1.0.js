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

// IAM audit logs. Run with application writes paused. Standalone MongoDB does
// not support multi-document transactions, so validate all legacy ownership
// before updating audit records. Interrupted backfills can be rerun safely.
const emptyAuditWorkspace = UUID("00000000-0000-0000-0000-000000000000");
const legacyAuditOwner = { $or: [
    { workspaceId: { $exists: false } },
    { workspaceId: null },
    { workspaceId: emptyAuditWorkspace }
] };

function resolveAuditOwnership(log) {
    let envId = log.envId;
    if (envId == null && log.refType === "Segment") {
        const json = log.dataChange && (log.dataChange.current || log.dataChange.previous);
        if (json) {
            const snapshot = JSON.parse(json);
            if (snapshot && snapshot.type === "shared" && snapshot.envId) {
                envId = UUID(snapshot.envId);
            }
        }
    }
    const environment = envId == null ? null : db.Environments.findOne({ _id: envId });
    const project = environment ? db.Projects.findOne({ _id: environment.projectId }) : null;
    const organization = project ? db.Organizations.findOne({ _id: project.organizationId }) : null;
    if (!organization || organization.workspaceId == null
        || organization.workspaceId.toString() === emptyAuditWorkspace.toString()) {
        throw new Error("Unresolved audit log ownership for " + EJSON.stringify(log._id)
            + ". Restore verified environment/project/organization ownership and rerun v6.1.0; no audit history was removed.");
    }
    return { envId, workspaceId: organization.workspaceId, organizationId: organization._id };
}

db.AuditLogs.find(legacyAuditOwner).forEach(log => resolveAuditOwnership(log));
db.AuditLogs.find(legacyAuditOwner).forEach(log => {
    db.AuditLogs.updateOne(
        { $and: [{ _id: log._id }, legacyAuditOwner] },
        { $set: resolveAuditOwnership(log) }
    );
});

// Keep explicitly owned records unchanged, including workspace-wide IAM logs
// and shared segments whose organizationId is intentionally null.
db.AuditLogs.createIndex(
    { workspaceId: 1, envId: 1, createdAt: -1, _id: -1 },
    { name: "ix_audit_logs_workspace_env_created" }
);
db.AuditLogs.createIndex(
    { workspaceId: 1, organizationId: 1, createdAt: -1, _id: -1 },
    { name: "ix_audit_logs_workspace_org_created" }
);
db.AuditLogs.createIndex(
    { workspaceId: 1, refType: 1, refId: 1, createdAt: -1, _id: -1 },
    { name: "ix_audit_logs_workspace_resource_created" }
);
