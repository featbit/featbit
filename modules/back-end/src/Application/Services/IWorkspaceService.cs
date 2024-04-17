using Domain.Workspaces;

namespace Application.Services;

public interface IWorkspaceService : IService<Workspace>
{
    Task<ICollection<Guid>> GetAllEnvIdsAsync(Guid workspaceId);

    Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key);
}