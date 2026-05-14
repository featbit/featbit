const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/867
// This PR added some new `OrderBy*` clauses in queries, and some mongodb backend requires all sorted fields to be indexed
db.Experiments.createIndex({createdAt: 1});
db.Groups.createIndex({createdAt: 1});
db.Users.createIndex({createdAt: 1});

// https://github.com/featbit/featbit/pull/868
// added indexes for RefreshTokens collection
db.RefreshTokens.createIndex({token: 1});
db.RefreshTokens.createIndex({revokedAt: 1});
