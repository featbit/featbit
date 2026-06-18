const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// Release-decision evidence collections are shared raw event datasets. They
// stay separate from legacy Events and from release-decision experiment/run
// records; analysis joins them to a run by flag, metric, and observation window.
db.ReleaseDecisionExperiments.createIndex({ featBitEnvId: 1, flagKey: 1, updatedAt: -1 });

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
