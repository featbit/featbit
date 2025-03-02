using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class GlobalUserService(AppDbContext dbContext)
    : EntityFrameworkCoreService<EndUser>(dbContext), IGlobalUserService
{
    public async Task<PagedResult<EndUser>> GetListAsync(Guid workspaceId, GlobalUserFilter filter)
    {
        var query = Queryable.Where(x => x.WorkspaceId == workspaceId && x.EnvId == null);

        var name = filter.Name?.ToLower();
        if (!string.IsNullOrEmpty(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name));
        }

        var total = await query.CountAsync();
        var endUsers = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip(filter.PageIndex * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync();

        return new PagedResult<EndUser>(total, endUsers);
    }
}