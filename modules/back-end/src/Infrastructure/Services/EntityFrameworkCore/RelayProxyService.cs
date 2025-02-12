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
}