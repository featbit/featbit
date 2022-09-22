using Domain.Identity;
using Infrastructure.MongoDb;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Identity;

public class MongoDbUserStore : IUserStore
{
    private readonly IMongoCollection<User> _users;

    public MongoDbUserStore(MongoDbClient mongo)
    {
        _users = mongo.CollectionOf<User>();
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