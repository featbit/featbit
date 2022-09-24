using Domain.Users;

namespace Infrastructure.Users;

public interface IUserStore
{
    Task<User?> FindByIdAsync(string id);

    Task<bool> UpdateAsync(User user);

    Task<User?> FindByEmailAsync(string email);
}