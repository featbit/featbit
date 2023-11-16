using Application.Services;
using Domain.Workspaces;

namespace Application.IntegrationTests.Stubs;

public class TestWorkspaceService : NullServiceBase<Workspace>, IWorkspaceService
{
    public Task<ICollection<Workspace>> GetByEmailAsync(string email)
    {
        var workspaces = new[]
        {
            TestWorkspace.Instance()
        };

        return Task.FromResult<ICollection<Workspace>>(workspaces);
    }

    public Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        var isUsed = workspaceId != TestWorkspace.Id && key == TestWorkspace.Key;

        return Task.FromResult(isUsed);
    }
}