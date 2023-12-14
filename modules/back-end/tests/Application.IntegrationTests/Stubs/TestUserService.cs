using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.Services;
using Domain.Users;
using Domain.Workspaces;

namespace Application.IntegrationTests.Stubs;

public class TestUserService : NullServiceBase<User>, IUserService
{
    public override Task<User> GetAsync(Guid id)
    {
        if (id != TestUser.Id)
        {
            throw new EntityNotFoundException(nameof(User), id.ToString());
        }

        return Task.FromResult(TestUser.Instance());
    }

    public override Task<User?> FindOneAsync(Expression<Func<User, bool>> predicate)
    {
        var user = TestUser.Instance();
        var func = predicate.Compile();
        var ret = func(user) ? user : null;

        return Task.FromResult(ret);
    }

    public Task<string> GetOperatorAsync(Guid operatorId)
    {
        var @operator = operatorId == TestUser.Id ? TestUser.Email : string.Empty;
        return Task.FromResult(@operator);
    }

    public Task<ICollection<User>> GetListAsync(IEnumerable<Guid> ids)
    {
        var users = new[]
        {
            TestUser.Instance()
        };

        return Task.FromResult<ICollection<User>>(users);
    }

    public Task<ICollection<Workspace>> GetWorkspacesAsync(string email)
    {
        var workspaces = new[]
        {
            TestWorkspace.Instance()
        };

        return Task.FromResult<ICollection<Workspace>>(workspaces);
    }

    public Task DeleteAsync(Guid id)
    {
        return Task.CompletedTask;
    }
}