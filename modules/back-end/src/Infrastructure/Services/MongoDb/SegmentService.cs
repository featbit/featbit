using System.Linq.Expressions;
using Application.Bases.Models;
using Application.Segments;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Resources;
using Domain.Segments;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.MongoDb;

public class SegmentService(MongoDbClient mongoDb, ILogger<SegmentService> logger)
    : MongoDbService<Segment>(mongoDb), ISegmentService
{
    public async Task<PagedResult<Segment>> GetListAsync(Guid workspaceId, string rn, SegmentFilter userFilter)
    {
        var filterBuilder = Builders<Segment>.Filter;

        var filters = new List<FilterDefinition<Segment>>
        {
            // workspace filter
            filterBuilder.Where(x => x.WorkspaceId == workspaceId),

            // rn filter
            filterBuilder.Where(x => x.Scopes.Any(y => $"{rn}:".StartsWith(string.Concat(y, ":"))))
        };

        // name filter
        var name = userFilter.Name;
        if (!string.IsNullOrWhiteSpace(name))
        {
            var nameFilter = filterBuilder.Where(
                segment => segment.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase)
            );
            filters.Add(nameFilter);
        }

        // archived filter
        var isArchivedFilter = filterBuilder.Eq(segment => segment.IsArchived, userFilter.IsArchived);
        filters.Add(isArchivedFilter);

        var filter = filterBuilder.And(filters);

        var totalCount = await Collection.CountDocumentsAsync(filter);
        var itemsQuery = Collection
            .Find(filter)
            .SortByDescending(segment => segment.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Limit(userFilter.PageSize);

        var items = await itemsQuery.ToListAsync();

        return new PagedResult<Segment>(totalCount, items);
    }

    public async Task<ICollection<Segment>> GetListAsync(Guid workspaceId, string rn, bool includeArchived = false)
    {
        var query = Queryable
            .Where(x => x.WorkspaceId == workspaceId && x.Scopes.Any(y => $"{rn}:".StartsWith(string.Concat(y, ":"))));

        if (!includeArchived)
        {
            query = query.Where(x => !x.IsArchived);
        }

        return await query.ToListAsync();
    }

    public async Task<ICollection<FlagReference>> GetFlagReferencesAsync(Guid envId, Guid id)
    {
        var segmentId = id.ToString();

        var query = MongoDb.QueryableOf<FeatureFlag>().Where(flag =>
            flag.EnvId == envId &&
            flag.Rules.Any(rule =>
                rule.Conditions.Any(condition =>
                    SegmentConsts.ConditionProperties.Contains(condition.Property) &&
                    condition.Value.Contains(segmentId)
                )
            )
        ).Select(x => new FlagReference
        {
            Id = x.Id,
            Name = x.Name,
            Key = x.Key
        });

        var references = await query.ToListAsync();
        foreach (var reference in references)
        {
            reference.EnvId = envId;
        }

        return references;
    }

    public async ValueTask<ICollection<Guid>> GetEnvironmentIdsAsync(Segment segment)
    {
        if (segment.IsEnvironmentSpecific)
        {
            return [segment.EnvId];
        }

        var envIds = new List<Guid>();
        foreach (var scope in segment.Scopes)
        {
            var (_, scopeEnvIds) = await TranslateScopeAsync(scope);
            envIds.AddRange(scopeEnvIds);
        }

        var distinct = envIds.Distinct().ToArray();
        return distinct;
    }

    public async Task<bool> IsKeyUsedAsync(Guid workspaceId, string type, Guid envId, string key)
    {
        Expression<Func<Segment, bool>> predicate = type switch
        {
            SegmentType.Shared => x =>
                x.WorkspaceId == workspaceId &&
                x.Type == SegmentType.Shared &&
                string.Equals(x.Key, key, StringComparison.OrdinalIgnoreCase),

            _ => x =>
                x.EnvId == envId &&
                x.Type == SegmentType.EnvironmentSpecific &&
                string.Equals(x.Key, key, StringComparison.OrdinalIgnoreCase)
        };

        return await AnyAsync(predicate);
    }

    public async Task<ICollection<string>> GetAllTagsAsync(Guid envId)
    {
        var filter = new ExpressionFilterDefinition<Segment>(x => x.EnvId == envId && !x.IsArchived);
        var cursor = await Collection.DistinctAsync<string>("tags", filter);
        return await cursor.ToListAsync();
    }

    public async Task<ICollection<SegmentCache>> GetCachesAsync()
    {
        var segments = await Queryable.ToListAsync();

        var caches = new List<SegmentCache>();

        // environment specific segments
        var envSegments = segments.Where(x => x.Type == SegmentType.EnvironmentSpecific);
        caches.AddRange(envSegments.Select(x => new SegmentCache([x.EnvId], x)));

        // shared segments
        await AddSharedSegmentCachesAsync();

        return caches;

        async Task AddSharedSegmentCachesAsync()
        {
            var sharedSegments = segments.Where(x => x.Type == SegmentType.Shared).ToArray();

            var scopesToTranslate = sharedSegments.SelectMany(x => x.Scopes)
                .Distinct()
                .ToArray();

            var translateScopeTasks = scopesToTranslate.Select(x => TranslateScopeAsync(x));
            var scopes = await Task.WhenAll(translateScopeTasks);

            foreach (var sharedSegment in sharedSegments)
            {
                var envIds = sharedSegment.Scopes
                    .SelectMany(scope => scopes.First(x => x.scope == scope).envIds)
                    .Distinct()
                    .ToArray();

                caches.Add(new SegmentCache(envIds, sharedSegment));
            }
        }
    }

    public async Task<Segment> GetCommittedAsync(Guid id)
    {
        var segment = await GetAsync(id);

        // The committed read must NEVER expose a pending (staged) change. The top-level
        // document is the committed value; drop the pending slot before returning it.
        segment.Pending = null;

        return segment;
    }

    public async Task SetPendingAsync(
        Guid id,
        Segment pendingValue,
        long version,
        Guid operatorId = default,
        string operation = Operations.Update,
        bool isTargetingChange = true)
    {
        // ensure the segment exists (committed value is left untouched)
        await GetAsync(id);

        // A pending value must never itself carry a pending change (no pending-within-pending);
        // null it out to keep the staged document flat (mirrors Segment.SetPending).
        if (pendingValue != null)
        {
            pendingValue.Pending = null;
        }

        var pending = new PendingSegmentChange
        {
            Version = version,
            Value = pendingValue,
            OperatorId = operatorId,
            Operation = operation,
            IsTargetingChange = isTargetingChange
        };

        // Monotonicity guard (#34): only stage this change when its version is STRICTLY GREATER
        // than both the already-staged pending version (if any) AND the committed version. An
        // out-of-order/stale stage carrying a lower version (but still above committed) must not
        // clobber a newer pending — otherwise the coordinator could later commit the stale value.
        // The filter is evaluated server-side so the check-and-set is atomic: if a concurrent
        // writer staged a newer pending after our existence check, the filter no longer matches
        // and this update becomes a no-op (MatchedCount == 0).
        var filter = Builders<Segment>.Filter.And(
            Builders<Segment>.Filter.Eq(x => x.Id, id),
            Builders<Segment>.Filter.Lt(x => x.CommittedVersion, version),
            Builders<Segment>.Filter.Or(
                Builders<Segment>.Filter.Eq(x => x.Pending, null),
                Builders<Segment>.Filter.Lt(x => x.Pending!.Version, version)
            )
        );
        var update = Builders<Segment>.Update.Set(x => x.Pending, pending);

        await Collection.UpdateOneAsync(filter, update);
    }

    public async Task<bool> PromotePendingAsync(Guid id, long expectedVersion)
    {
        var segment = await GetAsync(id);

        // Version guard (#33/#34): only promote if the pending change we are about to commit is
        // still the one the caller observed. If a racing SetPendingAsync replaced it (different
        // version) or it was already promoted (null), do nothing.
        if (segment.Pending?.Version != expectedVersion)
        {
            return false;
        }

        // promote pending -> committed in-memory, then persist the full document so the
        // committed value advances and the pending slot is cleared atomically.
        segment.PromotePending();

        // Optimistic replace filtered on Pending.Version == expectedVersion: if another writer
        // staged a new pending version after our read, the filter no longer matches and the
        // replace is a no-op (MatchedCount == 0), so a concurrent SetPendingAsync cannot be lost
        // (#33).
        var filter = Builders<Segment>.Filter.And(
            Builders<Segment>.Filter.Eq(x => x.Id, id),
            Builders<Segment>.Filter.Eq(x => x.Pending!.Version, expectedVersion)
        );

        var result = await Collection.ReplaceOneAsync(filter, segment);
        return result.MatchedCount > 0;
    }

    public async Task<IReadOnlyList<Segment>> GetPendingAsync()
    {
        // every segment that currently carries a staged change
        var segments = await FindManyAsync(x => x.Pending != null);
        return segments.ToList();
    }

    public async Task<IReadOnlyList<Segment>> GetAllCommittedAsync()
    {
        // enumerate every segment, then strip the pending slot so only the COMMITTED value is
        // exposed (mirroring GetCommittedAsync). The top-level document is the committed value.
        var segments = await FindManyAsync(_ => true);
        foreach (var segment in segments)
        {
            segment.Pending = null;
        }

        return segments.ToList();
    }

    private async Task<(string scope, ICollection<Guid> envIds)> TranslateScopeAsync(string scope)
    {
        if (!RN.TryParse(scope, out var props))
        {
            logger.LogError("Segment scope '{Scope}' is not a valid RN.", scope);

            return (scope, []);
        }

        var match = new Dictionary<string, string>();

        var envProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Env);
        if (envProp != null && envProp.Key != "*")
        {
            match.Add("key", envProp.Key);
        }

        var projectProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Project);
        if (projectProp != null && projectProp.Key != "*")
        {
            match.Add("projects.key", projectProp.Key);
        }

        var orgProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Organization);
        if (orgProp != null && orgProp.Key != "*")
        {
            match.Add("organizations.key", orgProp.Key);
        }

        var query = MongoDb.CollectionOf<Environment>().Aggregate()
            .Lookup("Projects", "projectId", "_id", "projects")
            .Unwind("projects")
            .Lookup("Organizations", "projects.organizationId", "_id", "organizations")
            .Unwind("organizations")
            .Match(new BsonDocument
            {
                {
                    "$and",
                    new BsonArray(match.Select(x => new BsonDocument(x.Key, x.Value)))
                }
            })
            .Project(new BsonDocument("_id", 1));

        var documents = await query.ToListAsync();
        return (scope, documents.Select(x => x["_id"].AsGuid).ToArray());
    }
}