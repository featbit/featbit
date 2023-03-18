using Application.AccessTokens;
using Application.Bases.Models;
using Domain.AccessTokens;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.AccessTokens;

public class AccessTokenService : MongoDbService<AccessToken>, IAccessTokenService
{
    public AccessTokenService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

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
            .Skip(filter.PageIndex * filter.PageSize)
            .OrderByDescending(x => x.CreatedAt)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<AccessToken>(totalCount, items);
    }

    public async Task DeleteAsync(Guid id)
    {
        await Collection.DeleteOneAsync(x => x.Id == id);
    }
}