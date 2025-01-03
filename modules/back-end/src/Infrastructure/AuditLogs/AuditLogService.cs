using Application.AuditLogs;
using Application.Bases.Models;
using Domain.AuditLogs;
using MongoDB.Driver;

namespace Infrastructure.AuditLogs;

public class AuditLogService : MongoDbService<AuditLog>, IAuditLogService
{
    public AuditLogService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<PagedResult<AuditLog>> GetListAsync(Guid envId, AuditLogFilter userFilter)
    {
        var filterBuilder = Builders<AuditLog>.Filter;

        var filters = new List<FilterDefinition<AuditLog>>();

        // env filter, by default we only query logs in the specified environment
        var crossEnvironment = userFilter.CrossEnvironment ?? false;
        if (!crossEnvironment)
        {
            var envFilter = filterBuilder.Eq(log => log.EnvId, envId);
            filters.Add(envFilter);
        }

        // query(keyword/comment) filter
        var query = userFilter.Query;
        if (!string.IsNullOrWhiteSpace(query))
        {
            var queryFilter = filterBuilder.Where(x =>
                x.Keyword.Contains(query, StringComparison.CurrentCultureIgnoreCase) ||
                x.Comment.Contains(query, StringComparison.CurrentCultureIgnoreCase)
            );

            filters.Add(queryFilter);
        }

        // creator filter
        var creator = userFilter.CreatorId;
        if (creator.HasValue)
        {
            var creatorFilter = filterBuilder.Eq(x => x.CreatorId, creator.Value);
            filters.Add(creatorFilter);
        }

        // refId filter
        var refId = userFilter.RefId;
        if (!string.IsNullOrWhiteSpace(refId))
        {
            var refIdFilter = filterBuilder.Eq(x => x.RefId, refId);
            filters.Add(refIdFilter);
        }

        // refType filter
        var refType = userFilter.RefType;
        if (!string.IsNullOrWhiteSpace(refType))
        {
            var refTypeFilter = filterBuilder.Eq(x => x.RefType, refType);
            filters.Add(refTypeFilter);
        }

        // data-range filter
        var from = userFilter.From;
        var to = userFilter.To;
        if (from.HasValue)
        {
            var fromDate = DateTimeOffset.FromUnixTimeMilliseconds(from.Value).UtcDateTime;
            var fromFilter = filterBuilder.Gte(x => x.CreatedAt, fromDate);
            filters.Add(fromFilter);
        }

        if (to.HasValue)
        {
            var toDate = DateTimeOffset.FromUnixTimeMilliseconds(to.Value).UtcDateTime;
            var toFilter = filterBuilder.Lte(x => x.CreatedAt, toDate);
            filters.Add(toFilter);
        }

        var filter = filterBuilder.And(filters);

        var totalCount = await Collection.CountDocumentsAsync(filter);

        var itemsQuery = Collection
            .Find(filter)
            .SortByDescending(auditLog => auditLog.CreatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Limit(userFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<AuditLog>(totalCount, items);
    }
}