using Domain.Workspaces;

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
}