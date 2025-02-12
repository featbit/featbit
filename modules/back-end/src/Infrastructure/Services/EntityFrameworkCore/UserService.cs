using Domain.AccessTokens;
using Domain.Users;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class UserService(AppDbContext dbContext) : EntityFrameworkCoreService<User>(dbContext), IUserService
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
        var accessToken = await QueryableOf<AccessToken>().FirstOrDefaultAsync(x => x.Id == operatorId);
        return accessToken?.Name ?? string.Empty;
    }

    public async Task<ICollection<User>> GetListAsync(IEnumerable<Guid> ids)
        => await FindManyAsync(x => ids.Contains(x.Id));

    public async Task<ICollection<Workspace>> GetWorkspacesAsync(string email)
    {
        var workspaces = QueryableOf<Workspace>();
        var users = QueryableOf<User>();

        var query =
            from workspace in workspaces
            join user in users
                on workspace.Id equals user.WorkspaceId
            where user.Email == email
            select workspace;

        return await query.ToListAsync();
    }
}