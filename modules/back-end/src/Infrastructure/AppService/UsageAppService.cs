using Dapper;
using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;
using Npgsql;

namespace Infrastructure.AppService;

public class UsageAppService(IConfiguration configuration, IServiceProvider serviceProvider) : IUsageAppService
{
    public async Task SaveRecordsAsync(
        Dictionary<Guid, HashSet<string>> endUsers,
        Dictionary<Guid, (int flagEvaluations, int customMetrics)> insights)
    {
        var dbProvider = configuration.GetDbProvider();

        var task = dbProvider.Name switch
        {
            DbProvider.Postgres => PostgresSaveAsync(),
            DbProvider.MongoDb => MongoDbSaveAsync(),
            _ => Task.CompletedTask
        };

        await task;

        return;

        async Task PostgresSaveAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            var now = DateTime.UtcNow;

            // Record each unique user once per month (DO NOTHING on conflict preserves first_seen_at).
            if (endUsers.Count > 0)
            {
                List<Guid> mauEnvIds = [];
                List<string> mauUserKeys = [];
                foreach (var endUser in endUsers)
                {
                    var (key, value) = endUser;

                    foreach (var userKey in value)
                    {
                        mauEnvIds.Add(key);
                        mauUserKeys.Add(userKey);
                    }
                }

                await connection.ExecuteAsync(
                    """
                    INSERT INTO usage_end_user_stats (env_id, year_month, user_key, first_seen_at)
                    SELECT env_id, @YearMonth, user_key, @FirstSeenAt
                    FROM unnest(
                        @EnvIds::uuid[],
                        @UserKeys::text[]
                    ) AS t(env_id, user_key)
                    ON CONFLICT (env_id, year_month, user_key) DO NOTHING
                    """,
                    new
                    {
                        EnvIds = mauEnvIds.ToArray(),
                        YearMonth = now.Year * 100 + now.Month,
                        UserKeys = mauUserKeys.ToArray(),
                        FirstSeenAt = now.Date
                    }
                );
            }

            // Accumulate daily flag evaluation and custom metric counts.
            // ON CONFLICT increments so multiple flushes per day are safe.
            if (insights.Count > 0)
            {
                List<Guid> envIds = [];
                List<int> flagEvaluations = [];
                List<int> customMetrics = [];
                foreach (var insight in insights)
                {
                    var (key, value) = insight;

                    envIds.Add(key);
                    flagEvaluations.Add(value.flagEvaluations);
                    customMetrics.Add(value.customMetrics);
                }

                await connection.ExecuteAsync(
                    """
                    INSERT INTO usage_event_stats (env_id, stats_date, flag_evaluations, custom_metrics)
                    SELECT env_id, @StatsDate, flag_evaluations, custom_metrics
                    FROM unnest(
                        @EnvIds::uuid[],
                        @FlagEvaluations::int[],
                        @CustomMetrics::int[]
                    ) AS t(env_id, flag_evaluations, custom_metrics)
                    ON CONFLICT (env_id, stats_date) DO UPDATE
                        SET flag_evaluations = usage_event_stats.flag_evaluations + EXCLUDED.flag_evaluations,
                            custom_metrics   = usage_event_stats.custom_metrics   + EXCLUDED.custom_metrics
                    """,
                    new
                    {
                        EnvIds = envIds.ToArray(),
                        StatsDate = now.Date,
                        FlagEvaluations = flagEvaluations.ToArray(),
                        CustomMetrics = customMetrics.ToArray()
                    }
                );
            }
        }

        async Task MongoDbSaveAsync()
        {
            var mongoClient = serviceProvider.GetRequiredService<MongoDbClient>();
            var now = DateTime.UtcNow;

            // Record each unique user once per month; $setOnInsert ensures firstSeenAt is never overwritten.
            if (endUsers.Count > 0)
            {
                var yearMonth = now.Year * 100 + now.Month;

                var mauCollection = mongoClient.CollectionOf("UsageEndUserStats");
                var mauUpdates = endUsers.SelectMany(kvp => kvp.Value.Select(userKey =>
                    {
                        var filter = Builders<BsonDocument>.Filter.And(
                            Builders<BsonDocument>.Filter.Eq("envId", new BsonBinaryData(kvp.Key, GuidRepresentation.Standard)),
                            Builders<BsonDocument>.Filter.Eq("yearMonth", yearMonth),
                            Builders<BsonDocument>.Filter.Eq("userKey", userKey)
                        );

                        var update = Builders<BsonDocument>.Update
                            .SetOnInsert("envId", new BsonBinaryData(kvp.Key, GuidRepresentation.Standard))
                            .SetOnInsert("yearMonth", yearMonth)
                            .SetOnInsert("userKey", userKey)
                            .SetOnInsert("firstSeenAt", now.Date);

                        return new UpdateOneModel<BsonDocument>(filter, update) { IsUpsert = true };
                    })
                );

                await mauCollection.BulkWriteAsync(mauUpdates);
            }

            // Accumulate daily flag evaluation and custom metric counts via $inc upsert.
            if (insights.Count > 0)
            {
                var statsCollection = mongoClient.CollectionOf("UsageEventStats");

                var statsUpdates = insights.Select(kvp =>
                {
                    var filter = Builders<BsonDocument>.Filter.And(
                        Builders<BsonDocument>.Filter.Eq("envId", new BsonBinaryData(kvp.Key, GuidRepresentation.Standard)),
                        Builders<BsonDocument>.Filter.Eq("statsDate", now.Date)
                    );

                    var update = Builders<BsonDocument>.Update
                        .Inc("flagEvaluations", kvp.Value.flagEvaluations)
                        .Inc("customMetrics", kvp.Value.customMetrics);

                    return new UpdateOneModel<BsonDocument>(filter, update) { IsUpsert = true };
                });

                await statsCollection.BulkWriteAsync(statsUpdates);
            }
        }
    }
}