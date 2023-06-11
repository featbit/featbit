using Application.Bases.Models;
using Application.RelayProxies;
using Domain.RelayProxies;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.RelayProxies;

public class RelayProxyService : MongoDbService<RelayProxy>, IRelayProxyService
{
    public RelayProxyService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<PagedResult<RelayProxy>> GetListAsync(Guid organizationId, RelayProxyFilter filter)
    {
        var query = Queryable.Where(x => x.OrganizationId == organizationId);

        var name = filter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .OrderByDescending(x => x.CreatedAt)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<RelayProxy>(totalCount, items);
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);
    }
}