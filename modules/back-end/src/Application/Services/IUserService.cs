using Domain.Users;

namespace Application.Services;

public interface IUserService
{
    Task<User> GetAsync(Guid id);

    Task<User> FindByEmailAsync(string email);
}