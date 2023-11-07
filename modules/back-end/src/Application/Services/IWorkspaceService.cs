using Domain.Workspaces;

namespace Application.Services;

public interface IWorkspaceService
{
    Task<IEnumerable<Workspace>> GetByEmailAsync(string email);
}