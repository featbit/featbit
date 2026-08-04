using System.Text.Json;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.Segments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FeatureFlagService(AppDbContext dbContext, ILogger<FeatureFlagService> logger)
    : EntityFrameworkCoreService<FeatureFlag>(dbContext), IFeatureFlagService
{
    public async Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter userFilter)
    {
        var query = Queryable.Where(x => x.EnvId == envId && x.IsArchived == userFilter.IsArchived);

        // name/key filter
        var nameOrKey = userFilter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(nameOrKey))
        {
            query = query.Where(flag => flag.Name.ToLower().Contains(nameOrKey) || flag.Key.ToLower().Contains(nameOrKey));
        }

        // isEnabled filter
        var isEnabled = userFilter.IsEnabled;
        if (isEnabled.HasValue)
        {
            query = query.Where(flag => flag.IsEnabled == isEnabled.Value);
        }

        // tags filter
        if (userFilter.Tags.Any())
        {
            query = query.Where(x => userFilter.Tags.All(y => x.Tags.Contains(y)));
        }

        var totalCount = await query.CountAsync();

        // sorting
        var sortQuery = userFilter.SortBy switch
        {
            "key" => query.OrderBy(x => x.Key),
            _ => query.OrderByDescending(x => x.CreatedAt)
        };

        var itemsQuery = sortQuery
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize);

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
            string.Equals(flag.Key.ToLower(), key.ToLower())
        );
    }

    public async Task<ICollection<string>> GetAllTagsAsync(Guid envId)
    {
        // https://github.com/npgsql/efcore.pg/issues/1525
        // https://github.com/dotnet/efcore/issues/32505
        // SelectMany is not supported in efcore 8.x

        var allTags = await Queryable
            .Where(x => x.EnvId == envId && !x.IsArchived)
            .Select(x => x.Tags)
            .ToListAsync();

        return allTags.SelectMany(x => x).Distinct().ToArray();
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

        var segments = await QueryableOf<Segment>()
            .Where(x => segmentIds.Contains(x.Id))
            .ToListAsync();

        return segments;
    }

    public async Task MarkAsUpdatedAsync(ICollection<Guid> flagIds, Guid operatorId)
    {
        var now = DateTime.UtcNow;

        await Set
            .Where(x => flagIds.Contains(x.Id))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(f => f.UpdatedAt, now)
                .SetProperty(f => f.UpdatorId, operatorId)
            );
    }

    public async Task<FeatureFlag> GetCommittedAsync(Guid envId, string key)
    {
        // No-tracking so stripping the pending slot below is purely a read-shaping
        // operation and never accidentally persisted on a later SaveChanges.
        var flag = await Queryable
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.EnvId == envId && x.Key == key);
        if (flag == null)
        {
            throw new EntityNotFoundException(nameof(FeatureFlag), $"{envId}-{key}");
        }

        // The committed read must NEVER expose a pending (staged) change. The top-level
        // row is the committed value; drop the pending slot before returning it.
        flag.Pending = null;

        return flag;
    }

    // Bounded retry budget for the optimistic-concurrency loops below: a racing writer that
    // wins the row makes SaveChanges throw DbUpdateConcurrencyException (Postgres xmin token,
    // #72/#76). Each retry re-reads the fresh row and re-evaluates the version guard, so a
    // losing racer converges to the same outcome the Mongo provider gets from its version-
    // filtered UpdateOneAsync/ReplaceOneAsync: no-op (SetPendingAsync) or false (PromotePendingAsync).
    // See PendingOpRetryPolicy for the budget/backoff rationale (shared with SegmentService, #107/#108).

    public async Task SetPendingAsync(Guid envId, string key, FeatureFlag pendingValue, long version)
    {
        for (var attempt = 0; ; attempt++)
        {
            // load the committed row (left otherwise untouched)
            var flag = await GetAsync(envId, key);

            // Monotonicity guard (#34): only stage this change when its version is STRICTLY GREATER
            // than both the already-staged pending version (if any) AND the committed version. An
            // out-of-order/stale stage carrying a lower version (but still above committed) must not
            // clobber a newer pending — otherwise the coordinator could later commit the stale value.
            if (version <= flag.CommittedVersion || (flag.Pending != null && version <= flag.Pending.Version))
            {
                // stale / out-of-order stage — leave the existing pending (or lack of one) intact
                return;
            }

            // write ONLY the pending data; committed fields stay as they are
            flag.SetPending(pendingValue, version);

            try
            {
                await UpdateAsync(flag);
                return;
            }
            catch (DbUpdateConcurrencyException) when (attempt < PendingOpRetryPolicy.MaxRetries)
            {
                // The xmin token (#76) closes the race: a racing writer committed first, so this
                // SaveChanges affected 0 rows. Detach the stale tracked entity — otherwise the
                // context's identity map would hand back this same stale instance on the re-read
                // below — and retry (after a jittered backoff); the guard above re-evaluates
                // against the fresh row.
                DbContext.Entry(flag).State = EntityState.Detached;
                await PendingOpRetryPolicy.DelayAsync(attempt + 1);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Retry budget exhausted (#107): pathological contention outlasted
                // PendingOpRetryPolicy.MaxRetries attempts. The handler has already staged this
                // change to Redis (it stages before this DB write), so this exception propagating
                // leaves that Redis stage orphaned — invisible to the coordinator until superseded
                // by the next edit of this flag, or reaped by StagedFlagGc. Log loudly before the
                // rethrow (callers' semantics unchanged) so this is diagnosable instead of a silent
                // Kafka-offset-committed loss.
                logger.LogError(
                    ex,
                    "SetPendingAsync exhausted {MaxRetries} retries for FeatureFlag {EnvId}/{Key} " +
                    "at version {Version} (attempt {Attempt}); the Redis stage for this change may " +
                    "now be orphaned until superseded by the next edit or reaped by StagedFlagGc.",
                    PendingOpRetryPolicy.MaxRetries, envId, key, version, attempt + 1);
                throw;
            }
        }
    }

    public async Task<bool> PromotePendingAsync(Guid envId, string key, long expectedVersion)
    {
        for (var attempt = 0; ; attempt++)
        {
            var flag = await GetAsync(envId, key);

            // Version guard (#33/#34): only promote if the pending change still matches the version
            // the caller observed. If it was replaced by a racing SetPendingAsync (different version)
            // or already promoted (null), do nothing.
            if (flag.Pending?.Version != expectedVersion)
            {
                return false;
            }

            // promote pending -> committed, then persist the full row so the committed
            // value advances and the pending slot is cleared.
            flag.PromotePending();

            try
            {
                await UpdateAsync(flag);
                return true;
            }
            catch (DbUpdateConcurrencyException) when (attempt < PendingOpRetryPolicy.MaxRetries)
            {
                // Same xmin-token race as SetPendingAsync above: a racing writer (re-stage or
                // another promote) committed first. Detach the stale tracked entity and retry
                // (after a jittered backoff); the version guard re-evaluates against the fresh
                // row and returns false if the pending it observed is no longer the pending
                // that's actually there.
                DbContext.Entry(flag).State = EntityState.Detached;
                await PendingOpRetryPolicy.DelayAsync(attempt + 1);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Retry budget exhausted (#107): unlike SetPendingAsync, propagating here does not
                // orphan a Redis stage (PromotePendingAsync is driven by the coordinator, which
                // retries on its own next tick) — but this is still pathological contention worth
                // surfacing loudly rather than as a silent thrown exception.
                logger.LogError(
                    ex,
                    "PromotePendingAsync exhausted {MaxRetries} retries for FeatureFlag {EnvId}/{Key} " +
                    "at expected version {ExpectedVersion} (attempt {Attempt}).",
                    PendingOpRetryPolicy.MaxRetries, envId, key, expectedVersion, attempt + 1);
                throw;
            }
        }
    }

    public async Task<IReadOnlyList<FeatureFlag>> GetPendingAsync()
    {
        // Pending is the jsonb column (B4). Postgres translates "pending IS NOT NULL"
        // for the whole jsonb document, so this is a server-side scan across all envs.
        return await Queryable
            .Where(f => f.Pending != null)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<FeatureFlag>> GetAllCommittedAsync()
    {
        // enumerate every flag (across all envs), mirroring how RedisPopulatingService loads all
        // flags, then strip the pending slot so only the COMMITTED value is exposed (mirroring
        // GetCommittedAsync). AsNoTracking so the strip is purely read-shaping and never persisted.
        var flags = await Queryable
            .AsNoTracking()
            .ToListAsync();

        foreach (var flag in flags)
        {
            flag.Pending = null;
        }

        return flags;
    }
}