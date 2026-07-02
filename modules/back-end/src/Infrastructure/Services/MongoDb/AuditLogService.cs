using Application.AuditLogs;
using Application.Bases.Models;
using Domain.AuditLogs;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class AuditLogService(MongoDbClient mongoDb) : MongoDbService<AuditLog>(mongoDb), IAuditLogService
{
    public async Task<PagedResult<AuditLog>> GetListAsync(Guid envId, AuditLogFilter userFilter)
    {
        var queryable = Queryable;

        // env filter, by default we only query logs in the specified environment
        var crossEnvironment = userFilter.CrossEnvironment ?? false;
        if (!crossEnvironment)
        {
            queryable = queryable.Where(x => x.EnvId == envId);
        }

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
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize)
            .ToListAsync();

        return new PagedResult<AuditLog>(totalCount, items);
    }

    public async Task<LastChange?> GetLastChangeAsync(Guid envId, string refType, string refId)
    {
        var lastChange = await Queryable.Where(x =>
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
        Guid envId,
        string refType,
        ICollection<string> refIds)
    {
        var pipeline = new[]
        {
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