using Application.Bases.Exceptions;
using Domain.AccessTokens;
using Domain.Users;
using Domain.Workspaces;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class UserService(MongoDbClient mongoDb) : MongoDbService<User>(mongoDb), IUserService
{
    public async Task<string> GetOperatorAsync(Guid operatorId)
    {
        if (operatorId == SystemUser.Id)
        {
            return "System";
        }

        var user = await FindOneAsync(x => x.Id == operatorId);
        if (user is not null)
        {
            return !string.IsNullOrWhiteSpace(user.Name) ? user.Name : user.Email;
        }

        // An operation can also be made by an access token through our Open Api, see "OpenApiHandler"
        var accessToken = await MongoDb.QueryableOf<AccessToken>().FirstOrDefaultAsync(x => x.Id == operatorId);
        return accessToken?.Name ?? string.Empty;
    }

    public async Task<ICollection<User>> GetListAsync(IEnumerable<Guid> ids)
        => await FindManyAsync(x => ids.Contains(x.Id));
    
    public async Task<ICollection<Workspace>> GetWorkspacesAsync(Guid userId)
    {
        var workspaces = MongoDb.QueryableOf<Workspace>();
        var workspaceUsers = MongoDb.QueryableOf<WorkspaceUser>();
        var users = MongoDb.QueryableOf<User>();

        var query =
            from workspace in workspaces
            join wu in workspaceUsers
                on workspace.Id equals wu.WorkspaceId
            where wu.UserId == userId
            select workspace;

        return await query.ToListAsync();
    }

    public async Task<User> GetUserByEmailAsync(Guid workspaceId, string email)
    {
        var workspaceUsers = MongoDb.QueryableOf<WorkspaceUser>();
        var users = MongoDb.QueryableOf<User>();

        var query =
            from wu in workspaceUsers
            join user in users
                on wu.UserId equals user.Id
            where wu.WorkspaceId == workspaceId && user.Email == email
            select user;

        var result = await query.FirstOrDefaultAsync();
        if (result is null)
        {
            throw new EntityNotFoundException(nameof(Workspace), $"{email}-{workspaceId}");
        }

        return result;
    }
}