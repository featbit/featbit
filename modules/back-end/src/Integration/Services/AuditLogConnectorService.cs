using Application.AuditLogs;
using Application.Bases.Models;
using Application.Services;
using Domain.AuditLogs;
using Infrastructure.Bases;
using Infrastructure.MongoDb;
using MongoDB.Driver;

namespace Infrastructure.AuditLogs;

public interface IAuditLogConnectorService : IService<AuditLog>
{
    public Task<List<AuditLog>> GetListByCreateAtAsync(DateTime createdAt, int returnCount);
}

public class AuditLogConnectorService : MongoDbService<AuditLog>, IAuditLogConnectorService
{
    public AuditLogConnectorService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<List<AuditLog>> GetListByCreateAtAsync(DateTime createdAt, int returnCount)
    {
        var filterBuilder = Builders<AuditLog>.Filter;

        var filters = new List<FilterDefinition<AuditLog>>
        {
            filterBuilder.Gt(log=>log.CreatedAt, createdAt)
        };

        var filter = filterBuilder.And(filters);

        var totalCount = await Collection.CountDocumentsAsync(filter);

        var itemsQuery = Collection
            .Find(filter)
            .SortByDescending(auditLog => auditLog.CreatedAt)
            .Limit(returnCount);

        var auditLogs = await itemsQuery.ToListAsync();

        return auditLogs;
    }
}