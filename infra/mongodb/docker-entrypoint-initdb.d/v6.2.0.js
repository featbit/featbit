db = db.getSiblingDB("featbit");

db.ObservabilityProviders.createIndex(
    { envId: 1, name: 1 },
    { unique: true, partialFilterExpression: { isDeleted: false } }
);
