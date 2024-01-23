#nullable enable

using System.Linq.Expressions;
using Domain.Bases;

namespace Application.Services;

public interface IService<TEntity> where TEntity : Entity
{
    Task<TEntity> GetAsync(Guid id);

    Task AddOneAsync(TEntity segment);

    Task AddManyAsync(IEnumerable<TEntity> entities);

    Task<TEntity?> FindOneAsync(Expression<Func<TEntity, bool>> predicate);

    Task<ICollection<TEntity>> FindManyAsync(Expression<Func<TEntity, bool>> predicate);

    Task<bool> AnyAsync(Expression<Func<TEntity, bool>> predicate);

    Task UpdateAsync(TEntity segment);
}