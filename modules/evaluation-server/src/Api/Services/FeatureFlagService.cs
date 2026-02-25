using System.Text.Json;
using Dapper;
using Infrastructure;
using Infrastructure.Persistence;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Persistence.Postgres;
using MongoDB.Bson;
using MongoDB.Driver;
using Npgsql;

namespace Api.Services;

public class FeatureFlagService(IConfiguration configuration, IServiceProvider serviceProvider)
    : IFeatureFlagService
{
    public async Task<ICollection<JsonElement>> GetListAsync(Guid envId, FeatureFlagFilter userFilter)
    {
        var dbProvider = configuration.GetDbProvider();

        var result = dbProvider.Name switch
        {
            DbProvider.MongoDb => await MongoDbGetAsync(),
            DbProvider.Postgres => await PostgresGetAsync(),
            _ => []
        };

        return result;

        async Task<ICollection<JsonElement>> MongoDbGetAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;
            var collection = db.GetCollection<BsonDocument>("FeatureFlags");

            var filterBuilder = Builders<BsonDocument>.Filter;
            var filters = new List<FilterDefinition<BsonDocument>>
            {
                // envId filter
                filterBuilder.Eq("envId", new BsonBinaryData(envId, GuidRepresentation.Standard))
            };

            // tags filter by mode (eg: all, any)
            var tags = userFilter.Tags ?? [];
            if (tags.Length > 0)
            {
                var tagsFilter = userFilter.TagFilterMode switch
                {
                    TagFilterMode.And => filterBuilder.All("tags", tags),
                    TagFilterMode.Or => filterBuilder.In("tags", tags),
                    _ => filterBuilder.Empty
                };

                filters.Add(tagsFilter);
            }

            // keys filter
            var keys = userFilter.Keys ?? [];
            if (keys.Length > 0)
            {
                var keysFilter = filterBuilder.In("key", keys);
                filters.Add(keysFilter);
            }

            // timestamp filter
            var timestamp = userFilter.Timestamp ?? 0;
            if (timestamp > 0)
            {
                var timeFilter = filterBuilder.Gt("updatedAt", DateTime.UnixEpoch.AddMilliseconds(timestamp));
                filters.Add(timeFilter);
            }

            var filter = filterBuilder.And(filters);

            var flags = await collection.Find(filter).ToListAsync();
            return flags.Select(x => x.ToJsonElement()).ToArray();
        }

        async Task<ICollection<JsonElement>> PostgresGetAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            var sql = "SELECT * FROM feature_flags WHERE env_id = @envId";
            var parameters = new DynamicParameters();
            parameters.Add("envId", envId);

            // tags filter by mode (eg: all, any)
            var tags = userFilter.Tags ?? [];
            if (tags.Length > 0)
            {
                var tagFilterSql = userFilter.TagFilterMode switch
                {
                    TagFilterMode.And => " AND tags @> @tags", // contains all tags
                    TagFilterMode.Or => " AND tags && @tags", // overlaps with tags
                    _ => string.Empty
                };

                if (!string.IsNullOrWhiteSpace(tagFilterSql))
                {
                    sql += tagFilterSql;
                    parameters.Add("tags", tags);
                }
            }

            // keys filter
            var keys = userFilter.Keys ?? [];
            if (keys.Length > 0)
            {
                sql += " AND key = ANY(@keys)";
                parameters.Add("keys", keys);
            }

            // timestamp filter
            var timestamp = userFilter.Timestamp ?? 0;
            if (timestamp > 0)
            {
                sql += " AND date_trunc('milliseconds', updated_at) > @time";
                parameters.Add("time", DateTimeOffset.FromUnixTimeMilliseconds(timestamp));
            }

            var rows = await connection.QueryAsync(sql, parameters);
            return rows.Select(x => RowSerializer.SerializeFlag((x as IDictionary<string, object>)!))
                .Select(x => JsonSerializer.Deserialize<JsonElement>(x))
                .ToArray();
        }
    }
}