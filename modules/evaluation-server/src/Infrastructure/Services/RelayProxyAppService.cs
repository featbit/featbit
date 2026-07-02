using System.Linq.Expressions;
using Dapper;
using Domain.Workspaces;
using Infrastructure.Persistence;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Bson;
using MongoDB.Driver;
using Npgsql;

namespace Infrastructure.Services;

public class RelayProxyAppService(IConfiguration configuration, IServiceProvider serviceProvider)
    : IRelayProxyAppService
{
    public async Task<Workspace?> GetWorkspaceAsync(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || !key.StartsWith("rp-"))
        {
            return null;
        }

        var dbProvider = configuration.GetDbProvider();
        return dbProvider.Name switch
        {
            DbProvider.Postgres => await PostgresGetWorkspaceAsync(),
            DbProvider.MongoDb => await MongoDbGetWorkspaceAsync(),
            _ => null
        };

        async Task<Workspace?> PostgresGetWorkspaceAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            var workspace = await connection.QueryFirstOrDefaultAsync<Workspace?>(
                """
                select ws.id, ws.license
                from relay_proxies rp
                         join organizations org on rp.organization_id = org.id
                         join workspaces ws on org.workspace_id = ws.id
                where rp.key = @Key
                """, new { Key = key }
            );

            return workspace;
        }

        async Task<Workspace?> MongoDbGetWorkspaceAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;

            var pipeline = new[]
            {
                new("$match", new BsonDocument("key", key)),
                new("$lookup", new BsonDocument
                {
                    { "from", "Organizations" },
                    { "localField", "organizationId" },
                    { "foreignField", "_id" },
                    { "as", "organization" }
                }),
                new("$unwind", "$organization"),
                new("$lookup", new BsonDocument
                {
                    { "from", "Workspaces" },
                    { "localField", "organization.workspaceId" },
                    { "foreignField", "_id" },
                    { "as", "workspace" }
                }),
                new BsonDocument("$unwind", "$workspace"),
                new BsonDocument("$project", new BsonDocument
                {
                    { "id", "$workspace._id" },
                    { "license", "$workspace.license" },
                })
            };

            var workspace = await db.GetCollection<BsonDocument>("RelayProxies")
                .Aggregate<BsonDocument>(pipeline)
                .FirstOrDefaultAsync();

            if (workspace is null)
            {
                return null;
            }

            return new Workspace
            {
                Id = workspace["id"].AsGuid,
                License = workspace["license"].IsBsonNull ? null : workspace["license"].AsString
            };
        }
    }

    public async Task<bool> CheckQuotaAsync(Workspace workspace)
    {
        var quota = workspace.GetAutoAgentQuota();
        if (quota <= 0)
        {
            return false;
        }

        var dbProvider = configuration.GetDbProvider();

        // get workspace level auto agent usage
        var usage = dbProvider.Name switch
        {
            DbProvider.Postgres => await PostgresGetUsageAsync(),
            DbProvider.MongoDb => await MongoDbGetUsageAsync(),
            _ => int.MaxValue
        };

        var isWithinQuota = usage < quota;
        return isWithinQuota;

        async Task<int> PostgresGetUsageAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            var workspaceUsage = await connection.ExecuteScalarAsync<int>(
                """
                select coalesce(sum(jsonb_array_length(auto_agents)), 0)
                from relay_proxies rp
                         join organizations org on rp.organization_id = org.id
                where org.workspace_id = @WorkspaceId
                """, new { WorkspaceId = workspace.Id }
            );

            return workspaceUsage;
        }

        async Task<int> MongoDbGetUsageAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;

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
                    { "organization.workspaceId", new BsonBinaryData(workspace.Id, GuidRepresentation.Standard) }
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

            var result = await db.GetCollection<BsonDocument>("RelayProxies")
                .Aggregate<BsonDocument>(pipeline)
                .FirstOrDefaultAsync();

            return result == null ? 0 : result["totalAutoAgents"].AsInt32;
        }
    }

    public async Task RegisterAgentAsync(string key, string agentId)
    {
        var dbProvider = configuration.GetDbProvider();

        switch (dbProvider.Name)
        {
            case DbProvider.MongoDb:
                await MongoDbRegisterAsync();
                break;
            case DbProvider.Postgres:
                await PostgresRegisterAsync();
                break;
        }

        return;

        async Task MongoDbRegisterAsync()
        {
            var mongodb = serviceProvider.GetRequiredService<IMongoDbClient>();
            var db = mongodb.Database;

            var filterBuilder = Builders<BsonDocument>.Filter;
            var filter = filterBuilder.And(
                filterBuilder.Eq("key", key),
                filterBuilder.Not(
                    filterBuilder.ElemMatch("autoAgents", filterBuilder.Eq("_id", agentId))
                )
            );

            var updateDefinition = Builders<BsonDocument>.Update.Push("autoAgents", new BsonDocument
            {
                { "_id", agentId },
                { "status", "{}" },
                { "registeredAt", DateTime.UtcNow }
            });

            await db.GetCollection<BsonDocument>("RelayProxies").UpdateOneAsync(filter, updateDefinition);
        }

        async Task PostgresRegisterAsync()
        {
            var dataSource = serviceProvider.GetRequiredService<NpgsqlDataSource>();
            await using var connection = await dataSource.OpenConnectionAsync();

            var param = new
            {
                AgentId = agentId,
                Key = key
            };

            await connection.ExecuteAsync(
                """
                update relay_proxies
                set auto_agents = jsonb_insert(
                        auto_agents,
                        '{0}',
                        jsonb_build_object(
                            'id', @AgentId,
                            'status', '{}',
                            'registeredAt', now()
                        ))
                where key = @Key
                  and not exists(select 1 from jsonb_array_elements(auto_agents) as agent where agent ->> 'id' = @AgentId)
                """, param
            );
        }
    }
}