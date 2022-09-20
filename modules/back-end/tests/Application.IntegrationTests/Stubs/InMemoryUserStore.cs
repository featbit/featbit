using Domain.Identity;
using Infrastructure.Identity;

namespace Application.IntegrationTests.Stubs;

public class TestUser
{
    public const string Id = "id";
    public const string Identity = "identity";
    public const string RealPassword = "pwd";
    public const string HashedPassword = "hashed-pwd";
}

public class InMemoryUserStore : IUserStore
{
    private readonly List<User> _users = new()
    {
        new User(TestUser.Id, TestUser.Identity, TestUser.HashedPassword)
    };

    public Task<bool> UpdateAsync(User user)
    {
        _users.RemoveAll(x => x.Id == user.Id);
        _users.Add(user);

        return Task.FromResult(true);
    }

    public Task<User?> FindByIdentityAsync(string identity)
    {
        return Task.FromResult(_users.FirstOrDefault(x => x.Identity == identity));
    }
}