using Application.Usages;
using Application.Workspaces;
using Domain.Workspaces;

namespace Application.Services;

public interface IWorkspaceService : IService<Workspace>
{
    Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key);

    Task<string> GetDefaultWorkspaceAsync();

    Task<int> GetFeatureUsageAsync(Guid workspaceId, string feature);

    Task SaveRecordsAsync(AggregatedUsageRecords records);

    Task<WorkspaceUsageVm> GetUsageAsync(Guid workspaceId, WorkspaceUsageFilter filter);
}