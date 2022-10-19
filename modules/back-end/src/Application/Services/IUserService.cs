using Domain.Users;

namespace Application.Services;

public interface IUserService
{
    Task<User> GetAsync(Guid id);

    Task<IEnumerable<User>> GetListAsync(IEnumerable<Guid> ids);

    Task<User> FindByEmailAsync(string email);

    Task UpdateAsync(User user);
}