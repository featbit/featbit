using Domain.Users;
using Infrastructure.MongoDb;
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

    public async Task<User?> FindByIdAsync(string id)
    {
        return await _users.AsQueryable().FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<bool> UpdateAsync(User user)
    {
        var result = await _users.ReplaceOneAsync(x => x.Id == user.Id, user);

        return result.IsAcknowledged;
    }

    public async Task<User?> FindByEmailAsync(string email)
    {
        return await _users.AsQueryable().FirstOrDefaultAsync(x => x.Email == email);
    }
}