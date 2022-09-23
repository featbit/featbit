using Domain.Users;
using Infrastructure.Users;

namespace Application.IntegrationTests.Stubs;

public class TestUser
{
    public const string Id = "id";
    public const string Email = "test@email.com";
    public const string RealPassword = "pwd";
    public const string HashedPassword = "hashed-pwd";
}

public class InMemoryUserStore : IUserStore
{
    private readonly List<User> _users = new()
    {
        new User(TestUser.Id, TestUser.Email, TestUser.HashedPassword)
    };

    public Task<bool> UpdateAsync(User user)
    {
        _users.RemoveAll(x => x.Id == user.Id);
        _users.Add(user);

        return Task.FromResult(true);
    }

    public Task<User?> FindByEmailAsync(string email)
    {
        return Task.FromResult(_users.FirstOrDefault(x => x.Email == email));
    }
}