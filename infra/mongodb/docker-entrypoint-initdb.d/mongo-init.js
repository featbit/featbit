print('Start #################################################################');

db = db.getSiblingDB('featbit');
db.createCollection('FeatureFlags');
db.FeatureFlags.createIndex({ "Id": 1 }, { unique: true });
db.FeatureFlags.createIndex({
    "EnvironmentId": 1, "FF.Name": "text", "IsArchived": 1
});
db.createCollection('EnvironmentUsers');
db.EnvironmentUsers.createIndex({ "Id": 1 }, { unique: true });
db.EnvironmentUsers.createIndex({
    "EnvironmentId": 1, "Name": "text", "Email": "text"
});
db.createCollection('EnvironmentUserProperties');
db.EnvironmentUserProperties.createIndex({ "Id": 1 }, { unique: true });
db.EnvironmentUserProperties.createIndex({ "EnvironmentId": 1 });
