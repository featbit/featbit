using Domain.Users;

namespace Infrastructure.Users;

public interface IUserStore
{
    Task<User?> FindByIdAsync(Guid id);

    Task AddAsync(User user);

    Task<bool> UpdateAsync(User user);

    Task<User?> FindByEmailAsync(string email);
}