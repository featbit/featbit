using Domain.Accounts;
using Domain.Users;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Accounts;

public class AccountService : MongoDbService<Account>,  IAccountService
{
    public AccountService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<IEnumerable<Account>> GetByEmailAsync(string email)
    {
        var accounts = MongoDb.QueryableOf<Account>();
        var users = MongoDb.QueryableOf<User>();

        var query =
            from account in accounts
            join user in users
                on account.Id equals user.AccountId
            where user.Email == email
            select account;

        return await query.ToListAsync();
    }
}