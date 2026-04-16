using Application.Services;
using Application.Usages;
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

    public Task<int> GetFeatureUsageAsync(Guid workspaceId, string feature)
    {
        return Task.FromResult(0);
    }

    public Task SaveRecordsAsync(AggregatedUsageRecords records)
    {
        return Task.CompletedTask;
    }
}