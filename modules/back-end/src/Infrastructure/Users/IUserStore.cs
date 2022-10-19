using System.Linq.Expressions;
using Domain.Users;

namespace Infrastructure.Users;

public interface IUserStore
{
    Task<User?> FindOneAsync(Expression<Func<User, bool>> predicate);

    Task<ICollection<User>> FindManyAsync(Expression<Func<User, bool>> predicate);

    Task AddAsync(User user);

    Task<bool> UpdateAsync(User user);
}