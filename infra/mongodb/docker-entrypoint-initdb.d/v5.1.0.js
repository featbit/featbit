const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/761

db.RelayProxies.updateMany(
    {},
    { $set: { autoAgents: [] } }
);

// Use bulkWrite for better performance instead of individual updates
const bulkOps = [];

// Process scopes transformation using aggregation pipeline for better performance
const relayProxies = db.RelayProxies.find(
    { scopes: { $exists: true, $ne: null } }, // Only process documents that have scopes
    { _id: 1, scopes: 1 } // Only fetch necessary fields
).toArray();

// Build bulk operations
relayProxies.forEach(proxy => {
    if (proxy.scopes && Array.isArray(proxy.scopes)) {
        const flattenedEnvIds = proxy.scopes.flatMap(scope => 
            scope && scope.envIds ? scope.envIds.map(envId => envId.toString()) : []
        );
        
        bulkOps.push({
            updateOne: {
                filter: { _id: proxy._id },
                update: { $set: { scopes: flattenedEnvIds } }
            }
        });
    }
});

// Execute bulk operation if there are operations to perform
if (bulkOps.length > 0) {
    db.RelayProxies.bulkWrite(bulkOps, { ordered: false });
}