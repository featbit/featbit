using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class GlobalUserService(AppDbContext dbContext)
    : EntityFrameworkCoreService<GlobalUser>(dbContext), IGlobalUserService
{
    public async Task<PagedResult<GlobalUser>> GetListAsync(Guid workspaceId, GlobalUserFilter filter)
    {
        var query = Queryable.Where(x => x.WorkspaceId == workspaceId && x.EnvId == null);

        var name = filter.Name;
        if (!string.IsNullOrEmpty(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var total = await query.CountAsync();
        var data = await query
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<GlobalUser>(total, data);
    }
}