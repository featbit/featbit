using Application.Bases.Exceptions;
using Application.Services;
using Domain.Users;

namespace Infrastructure.Users;

public class UserService : IUserService
{
    private readonly IUserStore _users;

    public UserService(IUserStore users)
    {
        _users = users;
    }
    
    public async Task<User> GetAsync(Guid id)
    {
        var user = await _users.FindByIdAsync(id);
        if (user == null)
        {
            throw new EntityNotFoundException(nameof(User), id.ToString());
        }

        return user;
    }
}