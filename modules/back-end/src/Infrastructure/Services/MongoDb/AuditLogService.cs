using Application.AuditLogs;
using Application.Bases.Models;
using Domain.AuditLogs;
using Domain.Organizations;
using Domain.Projects;
using Environment = Domain.Environments.Environment;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class AuditLogService(MongoDbClient mongoDb) : MongoDbService<AuditLog>(mongoDb), IAuditLogService
{
    public async Task<PagedResult<AuditLog>> GetListAsync(Guid workspaceId, Guid orgId, Guid? envId, AuditLogFilter userFilter)
    {
        var queryable = await ScopedLogs(workspaceId, orgId, envId, userFilter);

        // query(keyword/comment) filter
        var query = userFilter.Query;
        if (!string.IsNullOrWhiteSpace(query))
        {
            queryable = queryable.Where(x =>
                x.Keyword.Contains(query, StringComparison.CurrentCultureIgnoreCase) ||
                x.Comment.Contains(query, StringComparison.CurrentCultureIgnoreCase)
            );
        }

        // creator filter
        var creator = userFilter.CreatorId;
        if (creator.HasValue)
        {
            queryable = queryable.Where(x => x.CreatorId == creator.Value);
        }

        // refId filter
        var refId = userFilter.RefId;
        if (!string.IsNullOrWhiteSpace(refId))
        {
            queryable = queryable.Where(x => x.RefId == refId);
        }

        // refType filter
        var refType = userFilter.RefType;
        if (!string.IsNullOrWhiteSpace(refType))
        {
            queryable = queryable.Where(x => x.RefType == refType);
        }

        // data-range filter
        var from = userFilter.From;
        var to = userFilter.To;
        if (from.HasValue)
        {
            var fromDate = DateTimeOffset.FromUnixTimeMilliseconds(from.Value).UtcDateTime;
            queryable = queryable.Where(x => x.CreatedAt >= fromDate);
        }

        if (to.HasValue)
        {
            var toDate = DateTimeOffset.FromUnixTimeMilliseconds(to.Value).UtcDateTime;
            queryable = queryable.Where(x => x.CreatedAt <= toDate);
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.Id)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize)
            .ToListAsync();

        return new PagedResult<AuditLog>(totalCount, items);
    }

    private async Task<IQueryable<AuditLog>> ScopedLogs(Guid workspaceId, Guid orgId, Guid? envId, AuditLogFilter filter)
    {
        if (filter.Scope == AuditLogScope.Iam)
            return Queryable.Where(x => x.WorkspaceId == workspaceId && x.OrganizationId == orgId &&
                (x.RefType == AuditLogRefTypes.Member || x.RefType == AuditLogRefTypes.Group || x.RefType == AuditLogRefTypes.Policy));
        if (filter.Scope != AuditLogScope.Environment) throw new ArgumentOutOfRangeException(nameof(filter.Scope));
        if (!envId.HasValue) throw new ArgumentException("Environment is required.");
        var owner = await GetOwnerFilterAsync(workspaceId);
        var queryable = Queryable.Where(x => owner.Inject() &&
            (x.RefType == AuditLogRefTypes.FeatureFlag || x.RefType == AuditLogRefTypes.Segment));
        if (filter.CrossEnvironment != true) queryable = queryable.Where(x => x.EnvId == envId);

        return queryable;
    }

    private async Task<FilterDefinition<AuditLog>> GetOwnerFilterAsync(Guid workspaceId, Guid? envId = null)
    {
        // Legacy Mongo logs have no workspaceId. Resolve their environment ownership
        // rather than dropping tenant isolation when cross-environment history is requested.
        var orgIds = await MongoDb.QueryableOf<Organization>().Where(x => x.WorkspaceId == workspaceId)
            .Select(x => x.Id).ToListAsync();
        var projectIds = await MongoDb.QueryableOf<Project>().Where(x => orgIds.Contains(x.OrganizationId))
            .Select(x => x.Id).ToListAsync();
        var environments = MongoDb.QueryableOf<Environment>().Where(x => projectIds.Contains(x.ProjectId));
        if (envId.HasValue) environments = environments.Where(x => x.Id == envId.Value);
        var envIds = await environments
            .Select(x => (Guid?)x.Id).ToListAsync();
        var builder = Builders<AuditLog>.Filter;
        var legacyOwner = builder.And(
            builder.Or(builder.Exists(x => x.WorkspaceId, false), builder.Eq(x => x.WorkspaceId, Guid.Empty)),
            builder.In(x => x.EnvId, envIds));
        return builder.Or(builder.Eq(x => x.WorkspaceId, workspaceId), legacyOwner);
    }

    public async Task<LastChange?> GetLastChangeAsync(Guid workspaceId, Guid envId, string refType, string refId)
    {
        var owner = await GetOwnerFilterAsync(workspaceId, envId);
        var lastChange = await Queryable.Where(x => owner.Inject()).Where(x =>
                x.EnvId == envId &&
                x.RefType == refType &&
                x.RefId == refId &&
                x.Operation != Operations.Create
            )
            .Select(x => new LastChange
            {
                OperatorId = x.CreatorId,
                HappenedAt = x.CreatedAt,
                Comment = x.Comment
            })
            .OrderByDescending(x => x.HappenedAt)
            .FirstOrDefaultAsync();

        return lastChange;
    }

    public async Task<ICollection<LastChange>> GetLastChangesAsync(
        Guid workspaceId,
        Guid envId,
        string refType,
        ICollection<string> refIds)
    {
        var owner = await GetOwnerFilterAsync(workspaceId, envId);
        var pipeline = new[]
        {
            new BsonDocument("$match", owner.Render(new RenderArgs<AuditLog>(Collection.DocumentSerializer, Collection.Settings.SerializerRegistry))),
            new BsonDocument("$match", new BsonDocument
            {
                { "envId", new BsonBinaryData(envId, GuidRepresentation.Standard) },
                { "refType", refType },
                { "refId", new BsonDocument("$in", new BsonArray(refIds)) },
                { "operation", new BsonDocument("$ne", Operations.Create) }
            }),
            new BsonDocument("$sort", new BsonDocument("createdAt", -1)),
            new BsonDocument("$group", new BsonDocument
            {
                { "_id", "$refId" },
                { "operatorId", new BsonDocument("$first", "$creatorId") },
                { "happenedAt", new BsonDocument("$first", "$createdAt") },
                { "comment", new BsonDocument("$first", "$comment") }
            }),
            new BsonDocument("$project", new BsonDocument
            {
                { "_id", 0 },
                { "refId", "$_id" },
                { "operatorId", 1 },
                { "happenedAt", 1 },
                { "comment", 1 }
            })
        };

        var lastChanges = await Collection
            .Aggregate<LastChange>(pipeline)
            .ToListAsync();

        return lastChanges;
    }
}
