const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/940
db.FeatureFlags.updateMany(
    { committedVersion: { $exists: false } },
    { $set: { committedVersion: NumberLong(0) } }
);

db.Segments.updateMany(
    { committedVersion: { $exists: false } },
    { $set: { committedVersion: NumberLong(0) } }
);

db.dc_leases.createIndex({ dcId: 1 }, { unique: true });
db.dc_leases.createIndex({ leaseExpiresAt: 1 });

// https://github.com/featbit/featbit/pull/921
db.ExperimentExposureEvents.createIndex({ envId: 1, flagKey: 1, exposedAt: 1 });
db.ExperimentMetricEvents.createIndex({ envId: 1, eventName: 1, occurredAt: 1 });
db.Experiments.createIndex({ envId: 1, updatedAt: 1 });
db.ExperimentMetrics.createIndex({ envId: 1, key: 1 }, { unique: true });
db.ExperimentLayers.createIndex({ envId: 1, key: 1 }, { unique: true });
db.ExperimentRuns.createIndex({ experimentId: 1, slug: 1 }, { unique: true });
db.ExperimentRunAssignments.createIndex({ runId: 1, allocationKey: 1 }, { unique: true });
db.ExperimentRunAssignments.createIndex({ runId: 1, assignmentUnit: 1 }, { unique: true });

db.McpAccessTokenSessions.createIndex({ expiresAt: 1 });
db.McpAccessTokenSessions.createIndex({ tokenId: 1 }, { unique: true });
db.McpDeviceAuthorizations.createIndex({ deviceCodeHash: 1 }, { unique: true });
db.McpDeviceAuthorizations.createIndex({ expiresAt: 1 });
db.McpDeviceAuthorizations.createIndex({ userCode: 1 }, { unique: true });
db.McpRefreshAuthorizations.createIndex({ expiresAt: 1 });
db.McpRefreshAuthorizations.createIndex({ tokenHash: 1 }, { unique: true });