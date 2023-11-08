using Domain.Workspaces;
using Domain.Users;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Workspaces;

public class WorkspaceService : MongoDbService<Workspace>,  IWorkspaceService
{
    public WorkspaceService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<IEnumerable<Workspace>> GetByEmailAsync(string email)
    {
        var workspaces = MongoDb.QueryableOf<Workspace>();
        var users = MongoDb.QueryableOf<User>();

        var query =
            from workspace in workspaces
            join user in users
                on workspace.Id equals user.WorkspaceId
            where user.Email == email
            select workspace;

        return await query.ToListAsync();
    }
    
    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(ws =>
            ws.Id != workspaceId &&
            string.Equals(ws.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }
}