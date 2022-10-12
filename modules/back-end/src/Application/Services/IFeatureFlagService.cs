using System.Linq.Expressions;
using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IFeatureFlagService
{
    Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter);

    Task<FeatureFlag> GetAsync(Guid id);

    Task<FeatureFlag> GetAsync(Guid envId, string key);

    Task<bool> AnyAsync(Expression<Func<FeatureFlag, bool>> predicate);

    Task<ICollection<FeatureFlag>> FindManyAsync(Expression<Func<FeatureFlag, bool>> predicate);

    Task AddAsync(FeatureFlag flag);

    Task UpdateAsync(FeatureFlag flag);

    Task DeleteAsync(Guid id);
}