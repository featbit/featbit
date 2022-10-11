using System.Linq.Expressions;
using Domain.Triggers;

namespace Application.Services;

public interface ITriggerService
{
    Task<Trigger> GetAsync(Guid id);

    Task<ICollection<Trigger>> GetListAsync(Guid targetId);

    Task AddAsync(Trigger trigger);

    Task<Trigger> FindOneAsync(Expression<Func<Trigger, bool>> predicate);

    Task UpdateAsync(Trigger trigger);

    Task DeleteAsync(Guid id);
}