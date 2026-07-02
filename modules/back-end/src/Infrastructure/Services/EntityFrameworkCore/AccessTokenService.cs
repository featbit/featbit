using Application.AccessTokens;
using Application.Bases.Models;
using Domain.AccessTokens;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class AccessTokenService(AppDbContext dbContext)
    : EntityFrameworkCoreService<AccessToken>(dbContext), IAccessTokenService
{
    public async Task<PagedResult<AccessToken>> GetListAsync(Guid organizationId, AccessTokenFilter filter)
    {
        var query = Queryable.Where(x => x.OrganizationId == organizationId);

        var name = filter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name));
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

    public async Task<bool> IsNameUsedAsync(Guid organizationId, string name)
    {
        var isNameUsed = await AnyAsync(x =>
            x.OrganizationId == organizationId &&
            string.Equals(x.Name.ToLower(), name.ToLower())
        );

        return isNameUsed;
    }
}