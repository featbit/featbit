using Application.Bases.Models;
using Application.RelayProxies;
using Domain.RelayProxies;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class RelayProxyService(MongoDbClient mongoDb) : MongoDbService<RelayProxy>(mongoDb), IRelayProxyService
{
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
            .OrderByDescending(x => x.CreatedAt)
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<RelayProxy>(totalCount, items);
    }

    public Task<bool> IsNameUsedAsync(Guid organizationId, string name)
    {
        return AnyAsync(x =>
            x.OrganizationId == organizationId &&
            string.Equals(x.Name, name, StringComparison.CurrentCultureIgnoreCase)
        );
    }
}