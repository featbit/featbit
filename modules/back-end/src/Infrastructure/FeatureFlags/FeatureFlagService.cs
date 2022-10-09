using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.FeatureFlags;
using Application.Services;
using Domain.FeatureFlags;
using MongoDB.Driver;

namespace Infrastructure.FeatureFlags;

public class FeatureFlagService : MongoDbServiceBase<FeatureFlag>, IFeatureFlagService
{
    public FeatureFlagService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter userFilter)
    {
        var filterBuilder = Builders<FeatureFlag>.Filter;

        var filters = new List<FilterDefinition<FeatureFlag>>
        {
            // envId filter
            filterBuilder.Eq(flag => flag.EnvId, envId)
        };

        // name/key filter
        var nameOrKey = userFilter.Name;
        if (!string.IsNullOrWhiteSpace(nameOrKey))
        {
            var nameFilter = filterBuilder.Where(flag =>
                flag.Name.Contains(nameOrKey, StringComparison.CurrentCultureIgnoreCase) ||
                flag.Key.Contains(nameOrKey, StringComparison.CurrentCultureIgnoreCase)
            );
            filters.Add(nameFilter);
        }

        // includeArchived filter
        if (!userFilter.IncludeArchived)
        {
            var unArchiveFilter = filterBuilder.Eq(flag => flag.IsArchived, false);
            filters.Add(unArchiveFilter);
        }

        // isEnabled filter
        if (userFilter.IsEnabled.HasValue)
        {
            var isEnabled = userFilter.IsEnabled.Value;
            var statusFilter = filterBuilder.Where(flag => flag.IsEnabled == isEnabled);
            filters.Add(statusFilter);
        }

        var filter = filterBuilder.And(filters);

        var totalCount = await Collection.CountDocumentsAsync(filter);

        var itemsQuery = Collection
            .Find(filter)
            .SortByDescending(flag => flag.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Limit(userFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<FeatureFlag>(totalCount, items);
    }

    public async Task<FeatureFlag> GetAsync(Guid envId, string key)
    {
        var flag = await FindOneAsync(x => x.EnvId == envId && x.Key == key);
        if (flag == null)
        {
            throw new EntityNotFoundException(nameof(FeatureFlag), $"{envId}-{key}");
        }

        return flag;
    }
}