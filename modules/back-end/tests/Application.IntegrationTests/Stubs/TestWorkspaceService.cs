using System.Linq.Expressions;
using Application.Services;
using Domain.Workspaces;

namespace Application.IntegrationTests.Stubs;

public class TestWorkspaceService: IWorkspaceService
{
    public Task<Workspace> GetAsync(Guid id)
    {
        throw new NotImplementedException();
    }

    public Task AddOneAsync(Workspace segment)
    {
        throw new NotImplementedException();
    }

    public Task AddManyAsync(IEnumerable<Workspace> entities)
    {
        throw new NotImplementedException();
    }

    public Task<Workspace> FindOneAsync(Expression<Func<Workspace, bool>> predicate)
    {
        throw new NotImplementedException();
    }

    public Task<ICollection<Workspace>> FindManyAsync(Expression<Func<Workspace, bool>> predicate)
    {
        throw new NotImplementedException();
    }

    public Task<bool> AnyAsync(Expression<Func<Workspace, bool>> predicate)
    {
        throw new NotImplementedException();
    }

    public Task UpdateAsync(Workspace segment)
    {
        throw new NotImplementedException();
    }

    public Task<ICollection<Workspace>> GetByEmailAsync(string email)
    {
        var workspaces = new []
        {
            TestData.Workspace()
        };
        
        return Task.FromResult<ICollection<Workspace>>(workspaces);
    }

    public Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        throw new NotImplementedException();
    }
}