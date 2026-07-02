using Application.Bases.Models;
using Application.RelayProxies;
using Domain.RelayProxies;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class RelayProxyService(AppDbContext dbContext)
    : EntityFrameworkCoreService<RelayProxy>(dbContext), IRelayProxyService
{
    public async Task<PagedResult<RelayProxy>> GetListAsync(Guid organizationId, RelayProxyFilter filter)
    {
        var query = Queryable.Where(x => x.OrganizationId == organizationId);

        var name = filter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name));
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
        var isNameUsed = AnyAsync(x =>
            x.OrganizationId == organizationId &&
            string.Equals(x.Name.ToLower(), name.ToLower())
        );

        return isNameUsed;
    }
}