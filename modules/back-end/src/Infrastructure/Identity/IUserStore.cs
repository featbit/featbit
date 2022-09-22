using Domain.Identity;

namespace Infrastructure.Identity;

public interface IUserStore
{
    Task<bool> UpdateAsync(User user);

    Task<User?> FindByEmailAsync(string email);
}