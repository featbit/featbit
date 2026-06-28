const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// Release-decision evidence collections are shared raw event datasets. They
// stay separate from legacy Events and from release-decision experiment/run
// records; analysis joins them to a run by flag, metric, and observation window.
db.ReleaseDecisionExperiments.createIndex({ featBitEnvId: 1, updatedAt: -1 });
db.ReleaseDecisionExperiments.createIndex({ featBitProjectKey: 1 });
db.ReleaseDecisionExperiments.createIndex({ flagKey: 1 });
db.ReleaseDecisionExperiments.createIndex({ featBitEnvId: 1, flagKey: 1, updatedAt: -1 });

db.ReleaseDecisionLayers.createIndex({ featBitEnvId: 1, key: 1 }, { unique: true });
db.ReleaseDecisionLayers.createIndex({ featBitEnvId: 1, status: 1 });

db.ReleaseDecisionActivities.createIndex({ experimentId: 1, createdAt: -1 });
db.ReleaseDecisionActivities.createIndex({ experimentId: 1, actorId: 1 });

db.ReleaseDecisionExperimentRuns.createIndex({ experimentId: 1, slug: 1 }, { unique: true });

db.ReleaseDecisionExposureEvents.createIndex({ envId: 1, flagKey: 1, exposedAt: 1 });
db.ReleaseDecisionExposureEvents.createIndex({ envId: 1, userKey: 1, exposedAt: 1 });

db.ReleaseDecisionMetricEvents.createIndex({ envId: 1, eventName: 1, occurredAt: 1 });
db.ReleaseDecisionMetricEvents.createIndex({ envId: 1, eventName: 1, userKey: 1, occurredAt: 1 });

db.ReleaseDecisionRunVariantStats.createIndex(
    {
        runId: 1,
        metricEvent: 1,
        metricType: 1,
        metricAgg: 1,
        variation: 1,
        windowStart: 1,
        windowEnd: 1
    },
    { unique: true }
);

db.ReleaseDecisionRunAssignments.createIndex(
    { runId: 1, allocationKey: 1 },
    { unique: true }
);
db.ReleaseDecisionRunAssignments.createIndex(
    { runId: 1, assignmentUnit: 1 },
    { unique: true }
);
db.ReleaseDecisionRunAssignments.createIndex({ runId: 1, role: 1 });
db.ReleaseDecisionRunAssignments.createIndex({ runId: 1, analysisRole: 1 });

db.McpDeviceAuthorizations.createIndex({ deviceCodeHash: 1 }, { unique: true });
db.McpDeviceAuthorizations.createIndex({ userCode: 1 }, { unique: true });
db.McpDeviceAuthorizations.createIndex({ expiresAt: 1 });

db.McpRefreshAuthorizations.createIndex({ tokenHash: 1 }, { unique: true });
db.McpRefreshAuthorizations.createIndex({ expiresAt: 1 });

db.McpAccessTokenSessions.createIndex({ tokenId: 1 }, { unique: true });
db.McpAccessTokenSessions.createIndex({ expiresAt: 1 });
db.McpAccessTokenSessions.createIndex({ revokedAt: 1 });
