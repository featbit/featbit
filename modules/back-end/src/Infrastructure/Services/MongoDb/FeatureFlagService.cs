using System.Text.Json;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.Segments;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class FeatureFlagService : MongoDbService<FeatureFlag>, IFeatureFlagService
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

        var isArchivedFilter = filterBuilder.Eq(flag => flag.IsArchived, userFilter.IsArchived);
        filters.Add(isArchivedFilter);

        // isEnabled filter
        if (userFilter.IsEnabled.HasValue)
        {
            var isEnabled = userFilter.IsEnabled.Value;
            var statusFilter = filterBuilder.Where(flag => flag.IsEnabled == isEnabled);
            filters.Add(statusFilter);
        }

        // tags filter
        if (userFilter.Tags.Any())
        {
            var tagsFilter = filterBuilder.All(x => x.Tags, userFilter.Tags);
            filters.Add(tagsFilter);
        }

        var filter = filterBuilder.And(filters);

        var totalCount = await Collection.CountDocumentsAsync(filter);

        var query = Collection.Find(filter);

        // sorting
        var sortQuery = userFilter.SortBy switch
        {
            "key" => query.SortBy(x => x.Key),
            _ => query.SortByDescending(x => x.CreatedAt)
        };

        var itemsQuery = sortQuery
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

    public async Task<bool> HasKeyBeenUsedAsync(Guid envId, string key)
    {
        return await AnyAsync(flag =>
            flag.EnvId == envId &&
            string.Equals(flag.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }

    public async Task<ICollection<string>> GetAllTagsAsync(Guid envId)
    {
        var filter = new ExpressionFilterDefinition<FeatureFlag>(x => x.EnvId == envId && !x.IsArchived);
        var cursor = await Collection.DistinctAsync<string>("tags", filter);
        return await cursor.ToListAsync();
    }

    public async Task<ICollection<Segment>> GetRelatedSegmentsAsync(ICollection<FeatureFlag> flags)
    {
        var segmentIds = flags
            .SelectMany(flag => flag.Rules)
            .SelectMany(rule => rule.Conditions)
            .Where(condition => condition.IsSegmentCondition())
            .SelectMany(condition => JsonSerializer.Deserialize<string[]>(condition.Value)!)
            .Distinct()
            .Select(Guid.Parse)
            .ToArray();

        if (segmentIds.Length == 0)
        {
            return [];
        }

        var segments = await MongoDb.QueryableOf<Segment>()
            .Where(x => segmentIds.Contains(x.Id))
            .ToListAsync();

        return segments;
    }

    public async Task MarkAsUpdatedAsync(ICollection<Guid> flagIds, Guid operatorId)
    {
        var now = DateTime.UtcNow;

        var filter = Builders<FeatureFlag>.Filter.In(x => x.Id, flagIds);
        var update = Builders<FeatureFlag>.Update
            .Set(x => x.UpdatedAt, now)
            .Set(x => x.UpdatorId, operatorId);

        await Collection.UpdateManyAsync(filter, update);
    }
}