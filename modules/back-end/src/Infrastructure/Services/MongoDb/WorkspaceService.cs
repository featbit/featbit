using Application.Usages;
using Application.Workspaces;
using Domain.Workspaces;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class WorkspaceService(MongoDbClient mongoDb) : MongoDbService<Workspace>(mongoDb), IWorkspaceService
{
    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(ws =>
            ws.Id != workspaceId &&
            string.Equals(ws.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }

    public async Task<string> GetDefaultWorkspaceAsync()
    {
        if (await Queryable.CountAsync() != 1)
        {
            return string.Empty;
        }

        var first = await Queryable.FirstAsync();
        return first.Key;
    }

    public async Task<int> GetFeatureUsageAsync(Guid workspaceId, string feature)
    {
        return feature switch
        {
            LicenseFeatures.AutoAgents => await GetAutoAgentsUsageAsync(),
            _ => 0
        };

        async Task<int> GetAutoAgentsUsageAsync()
        {
            var pipeline = new[]
            {
                new BsonDocument("$lookup", new BsonDocument
                {
                    { "from", "Organizations" },
                    { "localField", "organizationId" },
                    { "foreignField", "_id" },
                    { "as", "organization" }
                }),
                new BsonDocument("$unwind", "$organization"),
                new BsonDocument("$match", new BsonDocument
                {
                    { "organization.workspaceId", new BsonBinaryData(workspaceId, GuidRepresentation.Standard) }
                }),
                new BsonDocument("$project", new BsonDocument
                {
                    {
                        "autoAgentCount", new BsonDocument("$cond", new BsonDocument
                        {
                            { "if", new BsonDocument("$isArray", "$autoAgents") },
                            { "then", new BsonDocument("$size", "$autoAgents") },
                            { "else", 0 }
                        })
                    }
                }),
                new BsonDocument("$group", new BsonDocument
                {
                    { "_id", BsonNull.Value },
                    { "totalAutoAgents", new BsonDocument("$sum", "$autoAgentCount") }
                })
            };

            var result = await MongoDb.CollectionOf("RelayProxies")
                .Aggregate<BsonDocument>(pipeline)
                .FirstOrDefaultAsync();

            return result == null ? 0 : result["totalAutoAgents"].AsInt32;
        }
    }

    public async Task SaveRecordsAsync(AggregatedUsageRecords records)
    {
        var (recordedAt, endUsers, events) = records;
        var recordedDateTime = recordedAt.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Record each unique user once per month; $setOnInsert ensures firstSeenAt is never overwritten.
        if (endUsers.Count > 0)
        {
            var yearMonth = recordedAt.Year * 100 + recordedAt.Month;

            var mauCollection = MongoDb.CollectionOf("UsageEndUserStats");
            var mauUpdates = endUsers.SelectMany(kvp => kvp.Value.Select(userKey =>
                {
                    var envId = new BsonBinaryData(kvp.Key, GuidRepresentation.Standard);

                    var filter = Builders<BsonDocument>.Filter.And(
                        Builders<BsonDocument>.Filter.Eq("envId", envId),
                        Builders<BsonDocument>.Filter.Eq("yearMonth", yearMonth),
                        Builders<BsonDocument>.Filter.Eq("userKey", userKey)
                    );

                    var update = Builders<BsonDocument>.Update
                        .SetOnInsert("envId", envId)
                        .SetOnInsert("yearMonth", yearMonth)
                        .SetOnInsert("userKey", userKey)
                        .SetOnInsert("firstSeenAt", recordedDateTime);

                    return new UpdateOneModel<BsonDocument>(filter, update) { IsUpsert = true };
                })
            ).ToArray();

            if (mauUpdates.Length > 0)
            {
                await mauCollection.BulkWriteAsync(mauUpdates);
            }
        }

        // Accumulate daily flag evaluation and custom metric counts via $inc upsert.
        if (events.Count > 0)
        {
            var statsCollection = MongoDb.CollectionOf("UsageEventStats");

            var statsUpdates = events.Select(kvp =>
            {
                var filter = Builders<BsonDocument>.Filter.And(
                    Builders<BsonDocument>.Filter.Eq("envId", new BsonBinaryData(kvp.Key, GuidRepresentation.Standard)),
                    Builders<BsonDocument>.Filter.Eq("statsDate", recordedDateTime)
                );

                var update = Builders<BsonDocument>.Update
                    .Inc("flagEvaluations", kvp.Value.FlagEvaluations)
                    .Inc("customMetrics", kvp.Value.CustomMetrics);

                return new UpdateOneModel<BsonDocument>(filter, update) { IsUpsert = true };
            });

            await statsCollection.BulkWriteAsync(statsUpdates);
        }
    }

    private record EnvDetail(BsonBinaryData EnvId, string OrgName, string ProjectName, string EnvName);
    public async Task<WorkspaceUsageVm> GetUsageAsync(Guid workspaceId, WorkspaceUsageFilter filter)
    {
        var envs = await FetchWorkspaceEnvs();
        if (envs.Length == 0)
        {
            return new WorkspaceUsageVm(
                new UsageSummaryVm(0, 0, 0, 0, 0, 0),
                [],
                []
            );
        }

        var (startDate, endDate, prevStartDate, prevEndDate) = filter;
        var currentYearMonth = startDate.Year * 100 + startDate.Month;
        var prevYearMonth = prevStartDate.Year * 100 + prevStartDate.Month;
        var startDateTime = startDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endDateTime = endDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var prevStartDateTime = prevStartDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var prevEndDateTime = prevEndDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var mauCollection = MongoDb.CollectionOf("UsageEndUserStats");
        var eventCollection = MongoDb.CollectionOf("UsageEventStats");

        var envIdFilter = Builders<BsonDocument>.Filter.In("envId", envs.Select(e => e.EnvId));

        // Single round-trip per collection using $facet
        var mauPipeline = new[]
        {
            new BsonDocument("$match", envIdFilter.Render(new RenderArgs<BsonDocument>(mauCollection.DocumentSerializer, mauCollection.Settings.SerializerRegistry))),
            new BsonDocument("$facet", new BsonDocument
            {
                {
                    "currentMau", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("yearMonth", currentYearMonth)),
                        new BsonDocument("$count", "count")
                    }
                },
                {
                    "prevMau", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("yearMonth", prevYearMonth)),
                        new BsonDocument("$count", "count")
                    }
                },
                {
                    "dailyNewUsers", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("yearMonth", currentYearMonth)),
                        new BsonDocument("$group", new BsonDocument
                        {
                            { "_id", "$firstSeenAt" },
                            { "newUsers", new BsonDocument("$sum", 1) }
                        }),
                        new BsonDocument("$sort", new BsonDocument("_id", 1))
                    }
                },
                {
                    "perEnvMau", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("yearMonth", currentYearMonth)),
                        new BsonDocument("$group", new BsonDocument
                        {
                            { "_id", "$envId" },
                            { "mau", new BsonDocument("$sum", 1) }
                        })
                    }
                }
            })
        };

        var eventPipeline = new[]
        {
            new BsonDocument("$match", envIdFilter.Render(new RenderArgs<BsonDocument>(eventCollection.DocumentSerializer, eventCollection.Settings.SerializerRegistry))),
            new BsonDocument("$facet", new BsonDocument
            {
                {
                    "currentEvents", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("statsDate", new BsonDocument { { "$gte", startDateTime }, { "$lt", endDateTime } })),
                        new BsonDocument("$group", new BsonDocument
                        {
                            { "_id", BsonNull.Value },
                            { "flagEvaluations", new BsonDocument("$sum", "$flagEvaluations") },
                            { "customMetrics", new BsonDocument("$sum", "$customMetrics") }
                        })
                    }
                },
                {
                    "prevEvents", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("statsDate", new BsonDocument { { "$gte", prevStartDateTime }, { "$lt", prevEndDateTime } })),
                        new BsonDocument("$group", new BsonDocument
                        {
                            { "_id", BsonNull.Value },
                            { "flagEvaluations", new BsonDocument("$sum", "$flagEvaluations") },
                            { "customMetrics", new BsonDocument("$sum", "$customMetrics") }
                        })
                    }
                },
                {
                    "dailyEvents", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("statsDate", new BsonDocument { { "$gte", startDateTime }, { "$lt", endDateTime } })),
                        new BsonDocument("$group", new BsonDocument
                        {
                            { "_id", "$statsDate" },
                            { "flagEvaluations", new BsonDocument("$sum", "$flagEvaluations") },
                            { "customMetrics", new BsonDocument("$sum", "$customMetrics") }
                        }),
                        new BsonDocument("$sort", new BsonDocument("_id", 1))
                    }
                },
                {
                    "perEnvEvents", new BsonArray
                    {
                        new BsonDocument("$match", new BsonDocument("statsDate", new BsonDocument { { "$gte", startDateTime }, { "$lt", endDateTime } })),
                        new BsonDocument("$group", new BsonDocument
                        {
                            { "_id", "$envId" },
                            { "flagEvaluations", new BsonDocument("$sum", "$flagEvaluations") },
                            { "customMetrics", new BsonDocument("$sum", "$customMetrics") }
                        })
                    }
                }
            })
        };

        var mauTask = mauCollection.Aggregate<BsonDocument>(mauPipeline).FirstOrDefaultAsync();
        var eventTask = eventCollection.Aggregate<BsonDocument>(eventPipeline).FirstOrDefaultAsync();
        await Task.WhenAll(mauTask, eventTask);

        var mauResult = mauTask.Result ?? new BsonDocument();
        var eventResult = eventTask.Result ?? new BsonDocument();

        var currentMauArr = mauResult.GetValue("currentMau", new BsonArray()).AsBsonArray;
        var prevMauArr = mauResult.GetValue("prevMau", new BsonArray()).AsBsonArray;
        var currentEventsArr = eventResult.GetValue("currentEvents", new BsonArray()).AsBsonArray;
        var prevEventsArr = eventResult.GetValue("prevEvents", new BsonArray()).AsBsonArray;

        var summary = new UsageSummaryVm(
            currentMauArr.Count > 0 ? currentMauArr[0]["count"].AsInt32 : 0,
            currentEventsArr.Count > 0 ? currentEventsArr[0]["flagEvaluations"].ToInt64() : 0,
            currentEventsArr.Count > 0 ? currentEventsArr[0]["customMetrics"].ToInt64() : 0,
            prevMauArr.Count > 0 ? prevMauArr[0]["count"].AsInt32 : 0,
            prevEventsArr.Count > 0 ? prevEventsArr[0]["flagEvaluations"].ToInt64() : 0,
            prevEventsArr.Count > 0 ? prevEventsArr[0]["customMetrics"].ToInt64() : 0
        );

        var dailyNewUsers = mauResult.GetValue("dailyNewUsers", new BsonArray()).AsBsonArray
            .ToDictionary(
                r => DateOnly.FromDateTime(r["_id"].ToUniversalTime()),
                r => r["newUsers"].AsInt32
            );
        var dailyEventsMap = eventResult.GetValue("dailyEvents", new BsonArray()).AsBsonArray
            .ToDictionary(
                r => DateOnly.FromDateTime(r["_id"].ToUniversalTime()),
                r => (FlagEvaluations: r["flagEvaluations"].ToInt64(), CustomMetrics: r["customMetrics"].ToInt64())
            );
        var allDates = dailyNewUsers.Keys.Union(dailyEventsMap.Keys).OrderBy(d => d);
        var dailyTrend = allDates.Select(date =>
        {
            dailyEventsMap.TryGetValue(date, out var ev);
            return new DailyTrendItemVm(
                date,
                dailyNewUsers.GetValueOrDefault(date),
                ev.FlagEvaluations,
                ev.CustomMetrics
            );
        }).ToArray();

        var perEnvMau = mauResult.GetValue("perEnvMau", new BsonArray()).AsBsonArray
            .ToDictionary(
                r => r["_id"].AsGuid,
                r => r["mau"].AsInt32
            );
        var perEnvEvents = eventResult.GetValue("perEnvEvents", new BsonArray()).AsBsonArray
            .ToDictionary(
                r => r["_id"].AsGuid,
                r => (FlagEvaluations: r["flagEvaluations"].ToInt64(), CustomMetrics: r["customMetrics"].ToInt64())
            );
        var envUsages = envs.Select(env =>
            {
                var envId = env.EnvId.AsGuid;
                perEnvMau.TryGetValue(envId, out var envMau);
                perEnvEvents.TryGetValue(envId, out var envEv);
                return new EnvironmentUsageVm(
                    env.OrgName, env.ProjectName, env.EnvName,
                    envId, envMau, envEv.FlagEvaluations, envEv.CustomMetrics
                );
            })
            .OrderByDescending(e => e.Mau)
            .ToArray();

        return new WorkspaceUsageVm(summary, dailyTrend, envUsages);

        async Task<EnvDetail[]> FetchWorkspaceEnvs()
        {
            var pipeline = new[]
            {
                new BsonDocument("$match", new BsonDocument(
                    "workspaceId",
                    new BsonBinaryData(workspaceId, GuidRepresentation.Standard))
                ),
                new BsonDocument("$lookup", new BsonDocument
                {
                    { "from", "Projects" },
                    { "localField", "_id" },
                    { "foreignField", "organizationId" },
                    { "as", "projects" }
                }),
                new BsonDocument("$unwind", "$projects"),
                new BsonDocument("$lookup", new BsonDocument
                {
                    { "from", "Environments" },
                    { "localField", "projects._id" },
                    { "foreignField", "projectId" },
                    { "as", "environments" }
                }),
                new BsonDocument("$unwind", "$environments"),
                new BsonDocument("$project", new BsonDocument
                {
                    { "_id", 0 },
                    { "orgName", "$name" },
                    { "projectName", "$projects.name" },
                    { "envId", "$environments._id" },
                    { "envName", "$environments.name" }
                })
            };

            var results = await MongoDb.CollectionOf("Organizations")
                .Aggregate<BsonDocument>(pipeline)
                .ToListAsync();

            return results.Select(row => new EnvDetail(
                row["envId"].AsBsonBinaryData,
                row["orgName"].AsString,
                row["projectName"].AsString,
                row["envName"].AsString
            )).ToArray();
        }
    }
}