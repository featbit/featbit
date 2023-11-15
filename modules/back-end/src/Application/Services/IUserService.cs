using Domain.Users;
using Domain.Workspaces;

namespace Application.Services;

public interface IUserService : IService<User>
{
    Task<ICollection<User>> GetListAsync(IEnumerable<Guid> ids);

    Task<ICollection<Workspace>> GetWorkspacesAsync(string email);

    Task DeleteAsync(Guid id);
}