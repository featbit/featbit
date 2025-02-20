using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class GlobalUserService(MongoDbClient mongoDb) : MongoDbService<EndUser>(mongoDb), IGlobalUserService
{
    public async Task<PagedResult<EndUser>> GetListAsync(Guid workspaceId, GlobalUserFilter filter)
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

        return new PagedResult<EndUser>(total, data);
    }
}