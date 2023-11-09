using Domain.Users;

namespace Application.Services;

public interface IUserService
{
    Task<User> GetAsync(Guid id);

    Task<ICollection<User>> GetListAsync(IEnumerable<Guid> ids);

    Task<User> FindByEmailAsync(string email, Guid workspaceId);

    Task UpdateAsync(User user);
    
    Task DeleteAsync(Guid userId);
}