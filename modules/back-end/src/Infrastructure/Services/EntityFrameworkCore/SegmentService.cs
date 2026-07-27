using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Segments;
using Dapper;
using Domain.AuditLogs;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using Domain.Segments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class SegmentService(AppDbContext dbContext, ILogger<SegmentService> logger)
    : EntityFrameworkCoreService<Segment>(dbContext), ISegmentService
{
    public async Task<PagedResult<Segment>> GetListAsync(Guid workspaceId, string rn, SegmentFilter userFilter)
    {
        var query = Queryable
            .Where(
                x => x.WorkspaceId == workspaceId &&
                     x.IsArchived == userFilter.IsArchived &&
                     x.Scopes.Any(y => $"{rn}:".StartsWith(string.Concat(y, ":")))
            );

        // name filter
        var name = userFilter.Name?.ToLower();
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(segment => segment.Name.ToLower().Contains(name));
        }

        var totalCount = await query.CountAsync();
        var itemsQuery = query
            .OrderByDescending(segment => segment.UpdatedAt)
            .Skip(userFilter.PageIndex * userFilter.PageSize)
            .Take(userFilter.PageSize);

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

        const string sql = """
                           SELECT id as Id, env_id as EnvId, name as Name, key as Key
                           FROM feature_flags
                           WHERE env_id = @envId
                             AND EXISTS (SELECT 1
                                         FROM jsonb_array_elements(rules) AS rule
                                         WHERE EXISTS (SELECT 1
                                                       FROM jsonb_array_elements(rule -> 'conditions') AS condition
                                                       WHERE condition ->> 'property' = ANY(@conditionProperties)
                                                         AND condition ->> 'value' LIKE '%' || @segmentId || '%'));
                           """;

        var parameters = new
        {
            envId,
            conditionProperties = SegmentConsts.ConditionProperties,
            segmentId
        };

        var references = await DbConnection.QueryAsync<FlagReference>(sql, parameters);
        return references.AsList();
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
                string.Equals(x.Key.ToLower(), key.ToLower()),

            _ => x =>
                x.EnvId == envId &&
                x.Type == SegmentType.EnvironmentSpecific &&
                string.Equals(x.Key.ToLower(), key.ToLower())
        };

        return await AnyAsync(predicate);
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

            var scopes = new List<(string scope, ICollection<Guid> envIds)>();
            foreach (var scopeToTranslate in scopesToTranslate)
            {
                scopes.Add(await TranslateScopeAsync(scopeToTranslate));
            }

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
        // No-tracking so stripping the pending slot below is purely a read-shaping
        // operation and never accidentally persisted on a later SaveChanges.
        var segment = await Queryable
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);
        if (segment == null)
        {
            throw new EntityNotFoundException(nameof(Segment), id.ToString());
        }

        // The committed read must NEVER expose a pending (staged) change. The top-level
        // row is the committed value; drop the pending slot before returning it.
        segment.Pending = null;

        return segment;
    }

    // Bounded retry budget for the optimistic-concurrency loops below: a racing writer that
    // wins the row makes SaveChanges throw DbUpdateConcurrencyException (Postgres xmin token,
    // #72/#76). Each retry re-reads the fresh row and re-evaluates the version guard, so a
    // losing racer converges to the same outcome the Mongo provider gets from its version-
    // filtered UpdateOneAsync/ReplaceOneAsync: no-op (SetPendingAsync) or false (PromotePendingAsync).
    // See PendingOpRetryPolicy for the budget/backoff rationale (shared with FeatureFlagService, #107/#108).

    public async Task SetPendingAsync(
        Guid id,
        Segment pendingValue,
        long version,
        Guid operatorId = default,
        string operation = Operations.Update,
        bool isTargetingChange = true)
    {
        for (var attempt = 0; ; attempt++)
        {
            // load the committed row (left otherwise untouched)
            var segment = await GetAsync(id);

            // Monotonicity guard (#34): only stage this change when its version is STRICTLY GREATER
            // than both the already-staged pending version (if any) AND the committed version. An
            // out-of-order/stale stage carrying a lower version (but still above committed) must not
            // clobber a newer pending — otherwise the coordinator could later commit the stale value.
            if (version <= segment.CommittedVersion || (segment.Pending != null && version <= segment.Pending.Version))
            {
                // stale / out-of-order stage — leave the existing pending (or lack of one) intact
                return;
            }

            // write ONLY the pending data; committed fields stay as they are
            segment.SetPending(pendingValue, version, operatorId, operation, isTargetingChange);

            try
            {
                await UpdateAsync(segment);
                return;
            }
            catch (DbUpdateConcurrencyException) when (attempt < PendingOpRetryPolicy.MaxRetries)
            {
                // The xmin token (#76) closes the race: a racing writer committed first, so this
                // SaveChanges affected 0 rows. Detach the stale tracked entity — otherwise the
                // context's identity map would hand back this same stale instance on the re-read
                // below — and retry (after a jittered backoff); the guard above re-evaluates
                // against the fresh row.
                DbContext.Entry(segment).State = EntityState.Detached;
                await PendingOpRetryPolicy.DelayAsync(attempt + 1);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                // Retry budget exhausted (#107): pathological contention outlasted
                // PendingOpRetryPolicy.MaxRetries attempts. The handler has already staged this
                // change to Redis (it stages before this DB write), so this exception propagating
                // leaves that Redis stage orphaned — invisible to the coordinator until superseded
                // by the next edit of this segment, or reaped by StagedFlagGc. Log loudly before
                // the rethrow (callers' semantics unchanged) so this is diagnosable instead of a
                // silent Kafka-offset-committed loss.
                logger.LogError(
                    ex,
                    "SetPendingAsync exhausted {MaxRetries} retries for Segment {SegmentId} at " +
                    "version {Version} (attempt {Attempt}); the Redis stage for this change may " +
                    "now be orphaned until superseded by the next edit or reaped by StagedFlagGc.",
                    PendingOpRetryPolicy.MaxRetries, id, version, attempt + 1);
                throw;
            }
        }
    }

    public async Task<bool> PromotePendingAsync(Guid id, long expectedVersion)
    {
        for (var attempt = 0; ; attempt++)
        {
            var segment = await GetAsync(id);

            // Version guard (#33/#34): only promote if the pending change still matches the version
            // the caller observed. If it was replaced by a racing SetPendingAsync (different version)
            // or already promoted (null), do nothing.
            if (segment.Pending?.Version != expectedVersion)
            {
                return false;
            }

            // promote pending -> committed, then persist the full row so the committed
            // value advances and the pending slot is cleared.
            segment.PromotePending();

            try
            {
                await UpdateAsync(segment);
                return true;
            }
            catch (DbUpdateConcurrencyException) when (attempt < PendingOpRetryPolicy.MaxRetries)
            {
                // Same xmin-token race as SetPendingAsync above: a racing writer (re-stage or
                // another promote) committed first. Detach the stale tracked entity and retry
                // (after a jittered backoff); the version guard re-evaluates against the fresh
                // row and returns false if the pending it observed is no longer the pending
                // that's actually there.
                DbContext.Entry(segment).State = EntityState.Detached;
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
                    "PromotePendingAsync exhausted {MaxRetries} retries for Segment {SegmentId} at " +
                    "expected version {ExpectedVersion} (attempt {Attempt}).",
                    PendingOpRetryPolicy.MaxRetries, id, expectedVersion, attempt + 1);
                throw;
            }
        }
    }

    public async Task<IReadOnlyList<Segment>> GetPendingAsync()
    {
        // Pending is the jsonb column. Postgres translates "pending IS NOT NULL"
        // for the whole jsonb document, so this is a server-side scan across all segments.
        return await Queryable
            .Where(s => s.Pending != null)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<Segment>> GetAllCommittedAsync()
    {
        // enumerate every segment, then strip the pending slot so only the COMMITTED value is
        // exposed (mirroring GetCommittedAsync). AsNoTracking so the strip is purely read-shaping
        // and never persisted.
        var segments = await Queryable
            .AsNoTracking()
            .ToListAsync();

        foreach (var segment in segments)
        {
            segment.Pending = null;
        }

        return segments;
    }

    private async Task<(string scope, ICollection<Guid> envIds)> TranslateScopeAsync(string scope)
    {
        if (!RN.TryParse(scope, out var props))
        {
            logger.LogError("Segment scope '{Scope}' is not a valid RN.", scope);

            return (scope, []);
        }

        var environments = QueryableOf<Environment>();
        var projects = QueryableOf<Project>();
        var organizations = QueryableOf<Organization>();

        var envProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Env);
        if (envProp != null && envProp.Key != "*")
        {
            environments = environments.Where(x => x.Key == envProp.Key);
        }

        var projectProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Project);
        if (projectProp != null && projectProp.Key != "*")
        {
            projects = projects.Where(x => x.Key == projectProp.Key);
        }

        var orgProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Organization);
        if (orgProp != null && orgProp.Key != "*")
        {
            organizations = organizations.Where(x => x.Key == orgProp.Key);
        }

        var query = from env in environments
            join project in projects on env.ProjectId equals project.Id
            join org in organizations on project.OrganizationId equals org.Id
            select env.Id;

        var ids = await query.ToListAsync();
        return (scope, ids);
    }
}