using Domain.Workspaces;

namespace Application.Services;

public interface IWorkspaceService : IService<Workspace>
{
    Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key);
}