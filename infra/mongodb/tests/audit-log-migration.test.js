// Run only in a disposable MongoDB instance with the repository's MongoDB
// directory mounted at /migration. The release script targets the featbit DB.
db = db.getSiblingDB("featbit");
function check(condition, message) {
    if (!condition) throw new Error(message);
}
const testWorkspace = UUID();
const testOrg = UUID();
const testProject = UUID();
const testEnvString = "b51a7c66-c7b4-4f22-b7cf-0ba481eb70f4";
const testEnv = UUID(testEnvString);
const testEmpty = UUID("00000000-0000-0000-0000-000000000000");
db.Organizations.insertOne({ _id: testOrg, workspaceId: testWorkspace });
db.Projects.insertOne({ _id: testProject, organizationId: testOrg });
db.Environments.insertOne({ _id: testEnv, projectId: testProject });
const snapshot = JSON.stringify({ type: "shared", envId: testEnvString });
db.AuditLogs.insertMany([
    { _id: "missing", envId: testEnv },
    { _id: "empty", envId: testEnv, workspaceId: testEmpty },
    { _id: "null", envId: testEnv, workspaceId: null },
    { _id: "shared-current", envId: null, refType: "Segment", dataChange: { current: snapshot, previous: "" } },
    { _id: "shared-previous", refType: "Segment", dataChange: { current: "", previous: snapshot } },
    { _id: "explicit", envId: testEnv, workspaceId: UUID(), organizationId: null },
    { _id: "iam", envId: null, workspaceId: testWorkspace, organizationId: null },
    { _id: "orphan", envId: UUID() }
]);
const explicitBefore = EJSON.stringify(db.AuditLogs.findOne({ _id: "explicit" }));
const iamBefore = EJSON.stringify(db.AuditLogs.findOne({ _id: "iam" }));
let rejected = false;
try { load("/migration/docker-entrypoint-initdb.d/v6.1.0.js"); }
catch (error) {
    check(error.message.includes("Unresolved audit log ownership"), error.message);
    rejected = true;
}
check(rejected, "Orphan ownership must stop migration");
check(!db.AuditLogs.findOne({ _id: "missing" }).workspaceId, "Preflight must not partially backfill logs");
check(db.AuditLogs.countDocuments({}) === 8, "Migration must preserve all audit history");
// Repair the orphan's verified ownership and retry.
db.AuditLogs.updateOne({ _id: "orphan" }, { $set: { envId: testEnv } });
load("/migration/docker-entrypoint-initdb.d/v6.1.0.js");
for (const id of ["missing", "empty", "null", "shared-current", "shared-previous", "orphan"]) {
    const log = db.AuditLogs.findOne({ _id: id });
    check(EJSON.stringify(log.workspaceId) === EJSON.stringify(testWorkspace), id + " workspace");
    check(EJSON.stringify(log.organizationId) === EJSON.stringify(testOrg), id + " organization");
    check(EJSON.stringify(log.envId) === EJSON.stringify(testEnv), id + " environment");
}
check(EJSON.stringify(db.AuditLogs.findOne({ _id: "explicit" })) === explicitBefore, "Explicit ownership changed");
check(EJSON.stringify(db.AuditLogs.findOne({ _id: "iam" })) === iamBefore, "Workspace IAM record changed");
const beforeRepeat = EJSON.stringify(db.AuditLogs.find().sort({ _id: 1 }).toArray());
load("/migration/docker-entrypoint-initdb.d/v6.1.0.js");
check(EJSON.stringify(db.AuditLogs.find().sort({ _id: 1 }).toArray()) === beforeRepeat, "Migration must be repeatable");
for (const [name, key] of [
    ["ix_audit_logs_workspace_env_created", { workspaceId: 1, envId: 1, createdAt: -1, _id: -1 }],
    ["ix_audit_logs_workspace_org_created", { workspaceId: 1, organizationId: 1, createdAt: -1, _id: -1 }],
    ["ix_audit_logs_workspace_resource_created", { workspaceId: 1, refType: 1, refId: 1, createdAt: -1, _id: -1 }]
]) {
    const index = db.AuditLogs.getIndexes().find(x => x.name === name);
    check(index && JSON.stringify(index.key) === JSON.stringify(key), name + " index definition");
}
print("PASS: legacy ownership, shared snapshots, orphan preflight, explicit ownership, repeatability and indexes");
