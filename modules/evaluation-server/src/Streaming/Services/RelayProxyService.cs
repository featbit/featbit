using System.Text.Json;
using Dapper;
using Domain.Shared;
using Infrastructure;
using Infrastructure.Fakes;
using Infrastructure.Persistence;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;
using Npgsql;

namespace Streaming.Services;

public class RelayProxyService(IConfiguration configuration, IServiceProvider serviceProvider)
    : IRelayProxyService
{
    public async Task<bool> IsKeyValidAsync(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || !key.StartsWith("rp-"))
        {
            return false;
        }

        var dbProvider = configuration.GetDbProvider();
        return dbProvider.Name switch
        {
            DbProvider.MongoDb => await MongoDbIsValidAsync(),
            DbProvider.Postgres => await PostgresIsValidAsync(),
            _ => false
        };

        async Task<bool> MongoDbIsValidAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;

            var count = await db.GetCollection<BsonDocument>("RelayProxies")
                .CountDocumentsAsync(x => x["key"].AsString == key);

            return count > 0;
        }

        async Task<bool> PostgresIsValidAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            var count = await connection.ExecuteScalarAsync<int>(
                "select count(1) from relay_proxies where key = @Key", new { Key = key }
            );

            return count > 0;
        }
    }

    public async Task<SecretWithValue[]> GetSecretsAsync(string key)
    {
        var dbProvider = configuration.GetDbProvider();

        var result = dbProvider.Name switch
        {
            DbProvider.MongoDb => await MongoDbGetAsync(),
            DbProvider.Postgres => await PostgresGetAsync(),
            // Fake store is for integration tests
            DbProvider.Fake => FakeStore.GetRpSecrets(key),
            _ => []
        };

        return result;

        async Task<SecretWithValue[]> PostgresGetAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();

            await using var connection = await dataSource.OpenConnectionAsync();

            var row =
                await connection.QueryFirstOrDefaultAsync<(Guid organizationId, string scopes, bool isAllEnvs)?>(
                    """
                    select organization_id as organizationId, scopes, is_all_envs as isAllEnvs
                    from relay_proxies
                    where key = @Key
                    """, new { Key = key }
                );

            if (row is null)
            {
                return [];
            }

            var rp = row.Value;

            var dynamicParameters = new DynamicParameters();
            var query = rp.isAllEnvs ? SearchByOrganization() : SearchByScopes();

            var secrets = await connection.QueryAsync<SecretWithValue>(query, dynamicParameters);
            return secrets.AsList().ToArray();

            string SearchByOrganization()
            {
                dynamicParameters.Add("OrganizationId", rp.organizationId);

                return
                    """
                    select env.id as envId, env.key as envKey, project.key as projectKey, secret ->> 'type' as type, secret ->> 'value' as value
                    from environments env
                             join projects project on env.project_id = project.id,
                         jsonb_array_elements(env.secrets) as secret
                    where project.organization_id = @OrganizationId
                    """;
            }

            string SearchByScopes()
            {
                List<Guid> envIds = [];

                using var scopeArray = JsonDocument.Parse(rp.scopes);
                foreach (var scopeElement in scopeArray.RootElement.EnumerateArray())
                {
                    envIds.AddRange(scopeElement.GetProperty("envIds").EnumerateArray().Select(x => x.GetGuid()));
                }

                dynamicParameters.Add("EnvIds", envIds);

                return """
                       select env.id as envId, env.key as envKey, project.key as projectKey, secret ->> 'type' as type, secret ->> 'value' as value
                       from environments env
                                join projects project on env.project_id = project.id,
                             jsonb_array_elements(env.secrets) as secret
                       where env.id = any(@EnvIds)
                       """;
            }
        }

        async Task<SecretWithValue[]> MongoDbGetAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;

            var rp = await db.GetCollection<BsonDocument>("RelayProxies")
                .Find(x => x["key"].AsString == key)
                .Project(x => new
                {
                    organizationId = x["organizationId"],
                    scopes = x["scopes"],
                    isAllEnvs = x["isAllEnvs"]
                })
                .FirstOrDefaultAsync();

            if (rp is null)
            {
                return [];
            }

            var pipeline = rp.isAllEnvs.AsBoolean ? SearchByOrganization() : SearchByScopes();
            var query = db
                .GetCollection<BsonDocument>("Environments")
                .Aggregate<BsonDocument>(pipeline);

            var documents = await query.ToListAsync();
            if (documents is null || documents.Count == 0)
            {
                return [];
            }

            var secretsWithValue = documents.SelectMany(document =>
            {
                var envId = document["env"]["id"].AsGuid;
                var envKey = document["env"]["key"].AsString;
                var projectKey = document["project"]["key"].AsString;
                var secrets = document["env"]["secrets"].AsBsonArray;

                return secrets.Select(x =>
                    new SecretWithValue(x["type"].AsString, projectKey, envId, envKey, x["value"].AsString)
                );
            });

            return secretsWithValue.ToArray();

            BsonDocument[] SearchByOrganization()
            {
                var organizationId = new BsonBinaryData(rp.organizationId.AsGuid, GuidRepresentation.Standard);

                return
                [
                    new BsonDocument("$lookup", new BsonDocument
                    {
                        { "from", "Projects" },
                        { "localField", "projectId" },
                        { "foreignField", "_id" },
                        { "as", "project" }
                    }),
                    new BsonDocument("$match", new BsonDocument("project.organizationId", organizationId)),
                    new BsonDocument("$unwind", "$project"),
                    new BsonDocument("$project", new BsonDocument
                    {
                        { "project", new BsonDocument { { "key", "$project.key" } } },
                        { "env", new BsonDocument { { "id", "$_id" }, { "key", "$key" }, { "secrets", "$secrets" } } }
                    })
                ];
            }

            BsonDocument[] SearchByScopes()
            {
                var envIds = rp.scopes.AsBsonArray.SelectMany(s => s.AsBsonDocument["envIds"].AsBsonArray);

                return
                [
                    new BsonDocument("$match", new BsonDocument("_id", new BsonDocument("$in", new BsonArray(envIds)))),
                    new BsonDocument("$lookup", new BsonDocument
                    {
                        { "from", "Projects" },
                        { "localField", "projectId" },
                        { "foreignField", "_id" },
                        { "as", "project" }
                    }),
                    new BsonDocument("$unwind", "$project"),
                    new BsonDocument("$project", new BsonDocument
                    {
                        { "project", new BsonDocument { { "key", "$project.key" } } },
                        { "env", new BsonDocument { { "id", "$_id" }, { "key", "$key" }, { "secrets", "$secrets" } } }
                    })
                ];
            }
        }
    }

    public async Task<Secret[]> GetServerSecretsAsync(string key)
    {
        var secretsWithValue = await GetSecretsAsync(key);

        var secrets = secretsWithValue
            .Where(x => x.Type == SecretTypes.Server)
            .Select(x => x.AsSecret())
            .ToArray();

        return secrets;
    }

    public async Task<string> RegisterAgentAsync(string key)
    {
        var dbProvider = configuration.GetDbProvider();

        var result = dbProvider.Name switch
        {
            DbProvider.MongoDb => await MongoDbRegisterAsync(),
            DbProvider.Postgres => await PostgresRegisterAsync(),
            _ => string.Empty
        };

        return result;

        async Task<string> MongoDbRegisterAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;

            var agentId = Guid.NewGuid().ToString();

            // TODO: insert new agent
            await Task.CompletedTask;
            return agentId;
        }

        async Task<string> PostgresRegisterAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            var agentId = Guid.NewGuid().ToString();

            // TODO: insert new agent
            return agentId;
        }
    }

    public Task UpdateAgentStatusAsync(string key, string agentId, string status)
    {
        var dbProvider = configuration.GetDbProvider();

        return dbProvider.Name switch
        {
            DbProvider.MongoDb => UpdateMongoDbAsync(),
            DbProvider.Postgres => UpdatePostgresAsync(),
            _ => Task.CompletedTask,
        };

        async Task UpdateMongoDbAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;

            // TODO: update rp agent status
            await Task.CompletedTask;
        }

        async Task UpdatePostgresAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            // TODO: update rp agent status
        }
    }
}