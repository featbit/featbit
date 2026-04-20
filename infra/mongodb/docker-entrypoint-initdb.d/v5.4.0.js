const dbName = "featbit";
print('use', dbName, 'database')
db = db.getSiblingDB(dbName)

// https://github.com/featbit/featbit/pull/885

db.Policies.updateMany(
    {
        "statements.actions": "ManageSegment"
    },
    [
        {
            $set: {
                statements: {
                    $map: {
                        input: "$statements",
                        as: "stmt",
                        in: {
                            $mergeObjects: [
                                "$$stmt",
                                {
                                    actions: {
                                        $map: {
                                            input: "$$stmt.actions",
                                            as: "action",
                                            in: {
                                                $cond: [
                                                    { $eq: ["$$action", "ManageSegment"] },
                                                    "*",
                                                    "$$action"
                                                ]
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }
    ]
);

db.Policies.updateMany(
    {
        _id: {
            $in: [
                UUID("3e961f0f-6fd4-4cf4-910f-52d356f8cc08"),
                UUID("66f3687f-939d-4257-bd3f-c3553d39e1b6")
            ]
        }
    },
    {
        $push: {
            statements: {
                id: UUID(),
                effect: "allow",
                actions: ["*"],
                resources: ["project/*:env/*:segment/*"],
                resourceType: "segment"
            }
        }
    }
);

db.AccessTokens.updateMany(
    {
        "permissions.actions": "ManageSegment"
    },
    [
        {
            $set: {
                permissions: {
                    $map: {
                        input: "$permissions",
                        as: "perm",
                        in: {
                            $mergeObjects: [
                                "$$perm",
                                {
                                    actions: {
                                        $map: {
                                            input: "$$perm.actions",
                                            as: "action",
                                            in: {
                                                $cond: [
                                                    { $eq: ["$$action", "ManageSegment"] },
                                                    "*",
                                                    "$$action"
                                                ]
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        }
    ]
);

// https://github.com/featbit/featbit/pull/888

// Daily aggregated metrics per environment.
// Equivalent of usage_event_stats in PostgreSQL.
// Documents: { envId, statsDate (date-only, no time), flagEvaluations, customMetrics }
// Upsert via $inc so concurrent writes accumulate correctly.
db.createCollection("UsageEventStats")
db.UsageEventStats.createIndex({ envId: 1, statsDate: 1 }, { unique: true });

// Monthly unique end users per environment.
// Equivalent of usage_end_user_stats in PostgreSQL.
// Documents: { envId, yearMonth (integer yyyyMM, e.g. 202604), userKey, firstSeenAt (date-only, no time) }
// firstSeenAt is written once on insert ($setOnInsert) and never overwritten.
//
// Queries this enables:
//   MAU / DAU  : db.UsageEndUserStats.countDocuments({ envId: { $in: [...] }, firstSeenAt: { $gte, $lte } })
//   Daily trend: ... $group by firstSeenAt
//   Per-env    : ... $group by envId
db.createCollection("UsageEndUserStats")
// yearMonth only appears here for per-month upsert deduplication, not for reads.
db.UsageEndUserStats.createIndex({ envId: 1, yearMonth: 1, userKey: 1 }, { unique: true });
// All read queries filter on (envId, firstSeenAt); yearMonth is not used in any read path.
db.UsageEndUserStats.createIndex({ envId: 1, firstSeenAt: 1 });
