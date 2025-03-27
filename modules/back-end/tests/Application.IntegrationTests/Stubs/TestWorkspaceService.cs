using Application.Services;
using Domain.Workspaces;

namespace Application.IntegrationTests.Stubs;

public class TestWorkspaceService : NullServiceBase<Workspace>, IWorkspaceService
{
    public Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        var isUsed = workspaceId != TestWorkspace.Id && key == TestWorkspace.Key;

        return Task.FromResult(isUsed);
    }

    public Task<string> GetDefaultWorkspaceAsync()
    {
        return Task.FromResult(TestWorkspace.Key);
    }
}