using Application.Usages;
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
    public async Task SaveRecordsAsync(AggregatedUsageRecords records)
    {
        var dbProvider = configuration.GetDbProvider();

        var task = dbProvider.Name switch
        {
            DbProvider.Postgres => PostgresSaveAsync(records),
            DbProvider.MongoDb => MongoDbSaveAsync(records),
            _ => Task.CompletedTask
        };

        await task;
    }

    private async Task PostgresSaveAsync(AggregatedUsageRecords records)
    {
        var (recordedAt, endUsers, events) = records;

        var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
        await using var connection = await dataSource.OpenConnectionAsync();

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

            // Record each unique user once per month (DO NOTHING on conflict preserves first_seen_at).
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
                    YearMonth = recordedAt.Year * 100 + recordedAt.Month,
                    UserKeys = mauUserKeys.ToArray(),
                    // The date time must be Unspecified kind, which PG already considered as local, and so timezone conversion wasn't applied when converting to date.
                    // Check https://github.com/npgsql/npgsql/issues/4471#issuecomment-1134314277 for details.
                    // https://www.npgsql.org/doc/types/datetime.html#net-types-and-postgresql-types
                    FirstSeenAt = recordedAt.ToDateTime(TimeOnly.MinValue)
                }
            );
        }

        if (events.Count > 0)
        {
            List<Guid> envIds = [];
            List<int> flagEvaluations = [];
            List<int> customMetrics = [];
            foreach (var insight in events)
            {
                var (key, value) = insight;

                envIds.Add(key);
                flagEvaluations.Add(value.FlagEvaluations);
                customMetrics.Add(value.CustomMetrics);
            }

            // Accumulate daily flag evaluation and custom metric counts.
            // ON CONFLICT increments so multiple flushes per day are safe.
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
                    // The date time must be Unspecified kind, which PG already considered as local, and so timezone conversion wasn't applied when converting to date.
                    // Check https://github.com/npgsql/npgsql/issues/4471#issuecomment-1134314277 for details.
                    // https://www.npgsql.org/doc/types/datetime.html#net-types-and-postgresql-types
                    StatsDate = recordedAt.ToDateTime(TimeOnly.MinValue),
                    FlagEvaluations = flagEvaluations.ToArray(),
                    CustomMetrics = customMetrics.ToArray()
                }
            );
        }
    }

    private async Task MongoDbSaveAsync(AggregatedUsageRecords records)
    {
        var (recordedAt, endUsers, events) = records;
        var recordedDateTime = recordedAt.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var mongoClient = serviceProvider.GetRequiredService<MongoDbClient>();

        // Record each unique user once per month; $setOnInsert ensures firstSeenAt is never overwritten.
        if (endUsers.Count > 0)
        {
            var yearMonth = recordedAt.Year * 100 + recordedAt.Month;

            var mauCollection = mongoClient.CollectionOf("UsageEndUserStats");
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
            var statsCollection = mongoClient.CollectionOf("UsageEventStats");

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
}