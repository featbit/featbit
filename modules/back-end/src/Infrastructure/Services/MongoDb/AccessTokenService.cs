using Application.AccessTokens;
using Application.Bases.Models;
using Domain.AccessTokens;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class AccessTokenService(MongoDbClient mongoDb) : MongoDbService<AccessToken>(mongoDb), IAccessTokenService
{
    public async Task<PagedResult<AccessToken>> GetListAsync(Guid organizationId, AccessTokenFilter filter)
    {
        var query = Queryable.Where(x => x.OrganizationId == organizationId);

        var name = filter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var type = filter.Type;
        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(x => x.Type == type);
        }

        var creatorId = filter.CreatorId;
        if (creatorId.HasValue)
        {
            query = query.Where(x => x.CreatorId == creatorId.Value);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<AccessToken>(totalCount, items);
    }

    public Task<bool> IsNameUsedAsync(Guid organizationId, string name)
    {
        return AnyAsync(x =>
            x.OrganizationId == organizationId &&
            string.Equals(x.Name, name, StringComparison.CurrentCultureIgnoreCase)
        );
    }
}