using Domain.Workspaces;

namespace Application.Services;

public interface IWorkspaceService: IService<Workspace>
{
    Task<ICollection<Workspace>> GetByEmailAsync(string email);
    
    Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key);
}