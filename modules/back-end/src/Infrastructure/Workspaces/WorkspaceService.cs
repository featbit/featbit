using Domain.Workspaces;
using MongoDB.Driver.Linq;

namespace Infrastructure.Workspaces;

public class WorkspaceService : MongoDbService<Workspace>, IWorkspaceService
{
    public WorkspaceService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(ws =>
            ws.Id != workspaceId &&
            string.Equals(ws.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }

    public async Task<string> GetDefaultWorkspaceAsync()
    {
        if (await Queryable.CountAsync() != 1)
        {
            return string.Empty;
        }

        var first = await Queryable.FirstAsync();
        return first.Key;
    }
}