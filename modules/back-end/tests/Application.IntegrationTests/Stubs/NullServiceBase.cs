using System.Linq.Expressions;
using Application.Services;
using Domain.Bases;

namespace Application.IntegrationTests.Stubs;

public class NullServiceBase<TEntity> : IService<TEntity> where TEntity : Entity
{
    public virtual Task<TEntity> GetAsync(Guid id) => null!;
    public virtual Task AddOneAsync(TEntity segment) => Task.CompletedTask;
    public virtual Task AddManyAsync(IEnumerable<TEntity> entities) => Task.CompletedTask;
    public virtual Task<TEntity?> FindOneAsync(Expression<Func<TEntity, bool>> predicate) => null!;
    public virtual Task<ICollection<TEntity>> FindManyAsync(Expression<Func<TEntity, bool>> predicate) => null!;
    public virtual Task<bool> AnyAsync(Expression<Func<TEntity, bool>> predicate) => Task.FromResult(false);
    public virtual Task UpdateAsync(TEntity segment) => Task.CompletedTask;
}