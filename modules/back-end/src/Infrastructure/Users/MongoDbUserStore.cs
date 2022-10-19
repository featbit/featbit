using System.Linq.Expressions;
using Domain.Users;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Users;

public class MongoDbUserStore : IUserStore
{
    private readonly IMongoCollection<User> _users;

    public MongoDbUserStore(MongoDbClient mongo)
    {
        _users = mongo.CollectionOf<User>();
    }

    public async Task<User?> FindOneAsync(Expression<Func<User, bool>> predicate)
    {
        return await _users.AsQueryable().FirstOrDefaultAsync(predicate);
    }

    public async Task<ICollection<User>> FindManyAsync(Expression<Func<User, bool>> predicate)
    {
        return await _users.AsQueryable().Where(predicate).ToListAsync();
    }

    public async Task AddAsync(User user)
    {
        await _users.InsertOneAsync(user);
    }

    public async Task<bool> UpdateAsync(User user)
    {
        var result = await _users.ReplaceOneAsync(x => x.Id == user.Id, user);

        return result.IsAcknowledged;
    }
}