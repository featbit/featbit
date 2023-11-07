using Application.Bases.Exceptions;
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
        var user = await _users.FindOneAsync(x => x.Id == id);
        if (user == null)
        {
            throw new EntityNotFoundException(nameof(User), id.ToString());
        }

        return user;
    }

    public async Task<ICollection<User>> GetListAsync(IEnumerable<Guid> ids)
    {
        return await _users.FindManyAsync(x => ids.Contains(x.Id));
    }

    public async Task<User?> FindByEmailAsync(string email, Guid workspaceId)
    {
        return await _users.FindOneAsync(x => x.Email == email && x.WorkspaceId == workspaceId);
    }

    public async Task UpdateAsync(User user)
    {
        await _users.UpdateAsync(user);
    }
}