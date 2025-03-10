using Domain.AccessTokens;
using Domain.Users;
using Domain.Workspaces;
using MongoDB.Driver;
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

    public async Task<ICollection<Workspace>> GetWorkspacesAsync(string email)
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
}