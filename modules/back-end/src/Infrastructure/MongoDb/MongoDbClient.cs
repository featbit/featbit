using Domain.AccessTokens;
using Domain.AuditLogs;
using Domain.EndUsers;
using Domain.ExperimentMetrics;
using Domain.Experiments;
using Domain.FeatureFlags;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Projects;
using Domain.Segments;
using Domain.Triggers;
using Domain.Users;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.MongoDb;

public class MongoDbClient
{
    protected MongoClient MongoClient { get; }

    protected IMongoDatabase Database { get; }

    public MongoDbClient(IOptions<MongoDbOptions> options)
    {
        var value = options.Value;

        // linq provider v3 has many improvement in version 2.14.x we should use it
        var clientSettings = MongoClientSettings.FromConnectionString(value.ConnectionString);
        clientSettings.LinqProvider = LinqProvider.V3;

        MongoClient = new MongoClient(clientSettings);
        Database = MongoClient.GetDatabase(value.Database);
    }

    private readonly Dictionary<Type, string> _collectionNameMap = new()
    {
        { typeof(User), "Users" },

        { typeof(Organization), "Organizations" },
        { typeof(OrganizationUser), "OrganizationUsers" },
        { typeof(Project), "Projects" },
        { typeof(Environment), "Environments" },
        { typeof(EndUser), "EndUsers" },
        { typeof(EndUserProperty), "EndUserProperties" },
        { typeof(Segment), "Segments" },
        { typeof(FeatureFlag), "FeatureFlags" },
        { typeof(Trigger), "Triggers" },
        { typeof(AuditLog), "AuditLogs" },

        { typeof(Group), "Groups" },
        { typeof(Policy), "Policies" },
        { typeof(GroupMember), "GroupMembers" },
        { typeof(GroupPolicy), "GroupPolicies" },
        { typeof(MemberPolicy), "MemberPolicies" },

        { typeof(Experiment), "Experiments" },
        { typeof(ExperimentMetric), "ExperimentMetrics" },
        
        { typeof(AccessToken), "AccessTokens" },
    };

    public IMongoCollection<TEntity> CollectionOf<TEntity>()
    {
        var collectionName = CollectionNameOf<TEntity>();
        var collection = Database.GetCollection<TEntity>(collectionName);
        return collection;
    }

    public string CollectionNameOf<TEntity>()
    {
        if (!_collectionNameMap.TryGetValue(typeof(TEntity), out var collectionName))
        {
            var exception = new ArgumentException(
                $"collection name of type {typeof(TEntity)} is not registered, " +
                "please register in _collectionNameMap first.");

            throw exception;
        }

        return collectionName;
    }

    public IMongoQueryable<TEntity> QueryableOf<TEntity>()
    {
        return CollectionOf<TEntity>().AsQueryable();
    }
}