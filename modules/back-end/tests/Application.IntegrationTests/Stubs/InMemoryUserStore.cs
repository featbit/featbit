using System.Linq.Expressions;
using Domain.Users;
using Infrastructure.Users;

namespace Application.IntegrationTests.Stubs;

public class InMemoryUserStore : IUserStore
{
    private readonly List<User> _users = new()
    {
        TestData.User()
    };

    public Task<User?> FindOneAsync(Expression<Func<User, bool>> predicate)
    {
        return Task.FromResult(_users.AsQueryable().FirstOrDefault(predicate));
    }

    public Task<ICollection<User>> FindManyAsync(Expression<Func<User, bool>> predicate)
    {
        return Task.FromResult<ICollection<User>>(_users.AsQueryable().Where(predicate).ToList());
    }

    public Task AddAsync(User user)
    {
        _users.Add(user);
        return Task.CompletedTask;
    }

    public Task<bool> UpdateAsync(User user)
    {
        _users.RemoveAll(x => x.Id == user.Id);
        _users.Add(user);

        return Task.FromResult(true);
    }

    public Task DeleteAsync(Guid userId)
    {
        _users.RemoveAll(x => x.Id == userId);

        return Task.FromResult(true);
    }
}