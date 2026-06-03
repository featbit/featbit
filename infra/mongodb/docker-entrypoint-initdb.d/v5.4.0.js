const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/906
db.Environments.updateMany(
    { settings: { $type: "array" } },
    { $set: { settings: {} } }
)

// https://github.com/featbit/featbit/pull/910
// ================================================================
// Migration: extract workspace membership out of Users collection
// ================================================================

// Step 1. Create the new WorkspaceUsers index (the collection will be created automatically if needed).
db.WorkspaceUsers.createIndex({ workspaceId: 1, userId: 1 }, { unique: true });

// Step 2. Resolve canonical user per email (earliest createdAt wins,
//         then earliest _id as tiebreaker) and insert one WorkspaceUsers
//         doc per original Users doc.
const canonicalByEmail = {};
db.Users.find({}).sort({ createdAt: 1, _id: 1 }).forEach(u => {
    if (!canonicalByEmail[u.email]) {
        canonicalByEmail[u.email] = u._id;
    }
});

db.Users.find({}).forEach(u => {
    const canonicalId = canonicalByEmail[u.email];
    db.WorkspaceUsers.updateOne(
        { workspaceId: u.workspaceId, userId: canonicalId },
        {
            $setOnInsert: {
                _id: UUID(),
                workspaceId: u.workspaceId,
                userId: canonicalId,
                createdAt: u.createdAt,
                updatedAt: u.updatedAt
            }
        },
        { upsert: true }
    );
});

// Step 3. Re-point dependent collections to the canonical user.
db.Users.find({}).forEach(u => {
    const canonicalId = canonicalByEmail[u.email];
    if (canonicalId.toString() !== u._id.toString()) {
        db.OrganizationUsers.updateMany(
            { userId: u._id },
            { $set: { userId: canonicalId } }
        );
        db.OrganizationUsers.updateMany(
            { invitorId: u._id },
            { $set: { invitorId: canonicalId } }
        );
        db.RefreshTokens.updateMany(
            { userId: u._id },
            { $set: { userId: canonicalId } }
        );
        db.AccessTokens.updateMany(
            { creatorId: u._id },
            { $set: { creatorId: canonicalId } }
        );
        db.AuditLogs.updateMany(
            { creatorId: u._id },
            { $set: { creatorId: canonicalId } }
        );
        db.ExperimentMetrics.updateMany(
            { maintainerUserId: u._id },
            { $set: { maintainerUserId: canonicalId } }
        );
        db.FeatureFlags.updateMany(
            { creatorId: u._id },
            { $set: { creatorId: canonicalId } }
        );
        db.FeatureFlags.updateMany(
            { updatorId: u._id },
            { $set: { updatorId: canonicalId } }
        );
        db.FlagChangeRequests.updateMany(
            { creatorId: u._id },
            { $set: { creatorId: canonicalId } }
        );
        db.FlagChangeRequests.updateMany(
            { updatorId: u._id },
            { $set: { updatorId: canonicalId } }
        );
        db.FlagChangeRequests.updateMany(
            { "reviewers.memberId": u._id },
            { $set: { "reviewers.$[elem].memberId": canonicalId } },
            { arrayFilters: [{ "elem.memberId": u._id }] }
        );
        db.FlagDrafts.updateMany(
            { creatorId: u._id },
            { $set: { creatorId: canonicalId } }
        );
        db.FlagDrafts.updateMany(
            { updatorId: u._id },
            { $set: { updatorId: canonicalId } }
        );
        db.FlagSchedules.updateMany(
            { creatorId: u._id },
            { $set: { creatorId: canonicalId } }
        );
        db.FlagSchedules.updateMany(
            { updatorId: u._id },
            { $set: { updatorId: canonicalId } }
        );
        db.GroupMembers.updateMany(
            { memberId: u._id },
            { $set: { memberId: canonicalId } }
        );
        db.MemberPolicies.updateMany(
            { memberId: u._id },
            { $set: { memberId: canonicalId } }
        );
        db.Webhooks.updateMany(
            { creatorId: u._id },
            { $set: { creatorId: canonicalId } }
        );
        db.Webhooks.updateMany(
            { updatorId: u._id },
            { $set: { updatorId: canonicalId } }
        );
    }
});

// Step 4. Delete duplicate (non-canonical) user docs.
const canonicalIds = Object.values(canonicalByEmail);
db.Users.deleteMany({ _id: { $nin: canonicalIds } });

// Step 5. Drop the now-redundant workspaceId field from Users.
db.Users.updateMany({}, { $unset: { workspaceId: "" } });

// Step 6. Add initialPassword to Users, copied from OrganizationUsers.
//         Uses the most recent record per user if multiple org memberships exist.
db.OrganizationUsers.aggregate([
    { $match: { initialPassword: { $exists: true, $ne: null } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$userId", initialPassword: { $first: "$initialPassword" } } }
]).forEach(doc => {
    db.Users.updateOne(
        { _id: doc._id },
        { $set: { initialPassword: doc.initialPassword } }
    );
});

// Step 7. Drop initialPassword from OrganizationUsers.
db.OrganizationUsers.updateMany({}, { $unset: { initialPassword: "" } });