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
        var filter = Builders<AuditLog>.Filter.Eq(auditLog => auditLog.EnvId, envId);

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