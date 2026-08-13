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

    public async Task<FeatureFlag> GetCommittedAsync(Guid envId, string key)
    {
        var flag = await FindOneAsync(x => x.EnvId == envId && x.Key == key);
        if (flag == null)
        {
            throw new EntityNotFoundException(nameof(FeatureFlag), $"{envId}-{key}");
        }

        // The committed read must NEVER expose a pending (staged) change. The top-level
        // document is the committed value; drop the pending slot before returning it.
        flag.Pending = null;

        return flag;
    }

    public async Task SetPendingAsync(Guid envId, string key, FeatureFlag pendingValue, long version)
    {
        // ensure the flag exists (committed value is left untouched)
        await GetAsync(envId, key);

        // A pending value must never itself carry a pending change (no pending-within-pending);
        // null it out to keep the staged document flat (mirrors FeatureFlag.SetPending).
        if (pendingValue != null)
        {
            pendingValue.Pending = null;
        }

        var pending = new PendingFlagChange
        {
            Version = version,
            Value = pendingValue
        };

        // Monotonicity guard (#34): only stage this change when its version is STRICTLY GREATER
        // than both the already-staged pending version (if any) AND the committed version. An
        // out-of-order/stale stage carrying a lower version (but still above committed) must not
        // clobber a newer pending — otherwise the coordinator could later commit the stale value.
        // The filter is evaluated server-side so the check-and-set is atomic: if a concurrent
        // writer staged a newer pending after our existence check, the filter no longer matches
        // and this update becomes a no-op (MatchedCount == 0).
        var filter = Builders<FeatureFlag>.Filter.And(
            Builders<FeatureFlag>.Filter.Eq(x => x.EnvId, envId),
            Builders<FeatureFlag>.Filter.Eq(x => x.Key, key),
            Builders<FeatureFlag>.Filter.Lt(x => x.CommittedVersion, version),
            Builders<FeatureFlag>.Filter.Or(
                Builders<FeatureFlag>.Filter.Eq(x => x.Pending, null),
                Builders<FeatureFlag>.Filter.Lt(x => x.Pending!.Version, version)
            )
        );
        var update = Builders<FeatureFlag>.Update.Set(x => x.Pending, pending);

        await Collection.UpdateOneAsync(filter, update);
    }

    public async Task<bool> PromotePendingAsync(Guid envId, string key, long expectedVersion)
    {
        var flag = await GetAsync(envId, key);

        // Version guard (#33/#34): only promote if the pending change we are about to commit is
        // still the one the caller observed. If a racing SetPendingAsync replaced it (different
        // version) or it was already promoted (null), do nothing.
        if (flag.Pending?.Version != expectedVersion)
        {
            return false;
        }

        // promote pending -> committed in-memory, then persist the full document so the
        // committed value advances and the pending slot is cleared atomically.
        flag.PromotePending();

        // Optimistic replace filtered on Pending.Version == expectedVersion: if another writer
        // staged a new pending version after our read, the filter no longer matches and the
        // replace is a no-op (MatchedCount == 0), so a concurrent SetPendingAsync cannot be lost
        // (#33).
        var filter = Builders<FeatureFlag>.Filter.And(
            Builders<FeatureFlag>.Filter.Eq(x => x.EnvId, envId),
            Builders<FeatureFlag>.Filter.Eq(x => x.Key, key),
            Builders<FeatureFlag>.Filter.Eq(x => x.Pending!.Version, expectedVersion)
        );

        var result = await Collection.ReplaceOneAsync(filter, flag);
        return result.MatchedCount > 0;
    }

    public async Task<IReadOnlyList<FeatureFlag>> GetPendingAsync()
    {
        // every flag (across all envs) that currently carries a staged change
        var flags = await FindManyAsync(x => x.Pending != null);
        return flags.ToList();
    }

    public async Task<IReadOnlyList<FeatureFlag>> GetAllCommittedAsync()
    {
        // enumerate every flag (across all envs), mirroring how RedisPopulatingService loads all
        // flags, then strip the pending slot so only the COMMITTED value is exposed (mirroring
        // GetCommittedAsync). The top-level document is the committed value.
        var flags = await FindManyAsync(_ => true);
        foreach (var flag in flags)
        {
            flag.Pending = null;
        }

        return flags.ToList();
    }
}