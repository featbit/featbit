using Domain.Users;

namespace Application.Services;

public interface IUserService
{
    Task<User> GetAsync(string id);
}