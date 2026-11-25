db = db.getSiblingDB("featbit");

db.ReleaseMetricSourceConnections.createIndex(
    { envId: 1 },
    { partialFilterExpression: { isDeleted: false } }
);
