using System.Text.Json;
using Application.Caches;
using Domain.Connections;
using Domain.ControlPlane;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Workspaces;
using StackExchange.Redis;

namespace Infrastructure.Caches.Redis;

public class RedisCacheService(IRedisClient redis) : ICacheService
{
    // --- Only-advance guards (#89) ------------------------------------------------------------
    // A DC cache backfill (DcBackfiller) snapshots the source-of-truth committed values once, then
    // writes them one at a time. If a NEWER commit lands on the same DC while an older snapshot's
    // write is still in flight, an unconditional overwrite would revert that DC's pointer/value
    // back to the stale snapshot. The scripts below make the targeted writes that back a
    // backfill only-advance: a stale `ts`/index-score never displaces a fresher one, server-side
    // and atomically (a single EVAL), so no client-side race window exists.

    /// <summary>
    /// Only-advance compare-and-set for a single string pointer key: KEYS[1] is set to ARGV[1] only
    /// if the key does not yet exist or its current value is strictly less than ARGV[1]. Backs the
    /// committed-pointer flip in <see cref="CommitFlagAsync"/>/<see cref="CommitSegmentAsync"/>.
    /// </summary>
    private const string OnlyAdvancePointerScript = """
        local current = redis.call('GET', KEYS[1])
        if current == false or tonumber(ARGV[1]) > tonumber(current) then
            redis.call('SET', KEYS[1], ARGV[1])
            return 1
        end
        return 0
        """;

    /// <summary>
    /// Only-advance guarded upsert keyed off one or more sorted-set index scores (the version
    /// register every normal upsert/commit already maintains as UpdatedAt-unix-ms): KEYS[1] is the
    /// value key, KEYS[2..N] are the index keys (a flag has exactly one; a segment can have one per
    /// env it belongs to). Two decisions, evaluated independently in the same atomic EVAL:
    /// <list type="bullet">
    /// <item>The value key is written iff the new score ARGV[3] is strictly greater than the
    /// register — the MAX of ZSCORE(KEYS[i], ARGV[2]) across ALL of KEYS[2..N] (a missing
    /// member/key contributes nothing, i.e. is treated as absent/-inf, never as 0). So the value
    /// key can only ever be overwritten with content that is strictly newer than EVERY env's
    /// current index score; a single lagging/desynced index is enough to block it, exactly as a
    /// single fresher env should.</item>
    /// <item>EVERY index key still gets an unconditional <c>ZADD ... GT</c> for ARGV[3]/ARGV[2],
    /// regardless of whether the value key ended up written. GT is a per-key only-advance
    /// primitive: an index already at or ahead of ARGV[3] is left untouched (so no index can ever
    /// move backward, and none can be dragged past what its own history supports), while a
    /// lagging index that is behind ARGV[3] still catches up — even on a call where the value key
    /// write was blocked by a *different*, fresher env. This lets desynced indexes re-converge
    /// over time without ever letting an index overstate freshness beyond the true committed
    /// register (GT can only advance a lagging index up to ARGV[3], and ARGV[3] was, by
    /// construction, not fresher than the value actually on disk when the value write was
    /// blocked).</item>
    /// </list>
    /// Returns 1 iff the value key was written, 0 otherwise. Backs the targeted BestEffort legacy
    /// upserts used by the backfiller (<see cref="UpsertFlagIfNewerAsync"/> passes a single index
    /// key; <see cref="UpsertSegmentIfNewerAsync"/> passes one per env).
    /// </summary>
    private const string OnlyAdvanceIndexedUpsertScript = """
        local register = nil
        for i = 2, #KEYS do
            local score = redis.call('ZSCORE', KEYS[i], ARGV[2])
            if score ~= false then
                local n = tonumber(score)
                if register == nil or n > register then
                    register = n
                end
            end
        end

        local wrote = 0
        if register == nil or tonumber(ARGV[3]) > register then
            redis.call('SET', KEYS[1], ARGV[1])
            wrote = 1
        end

        for i = 2, #KEYS do
            redis.call('ZADD', KEYS[i], 'GT', ARGV[3], ARGV[2])
        end

        return wrote
        """;

    private IDatabase Redis => redis.GetDatabase();

    public async Task UpsertFlagAsync(FeatureFlag flag)
    {
        // upsert flag
        var cache = RedisCaches.Flag(flag);
        await Redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        var index = RedisCaches.FlagIndex(flag);
        await Redis.SortedSetAddAsync(index.Key, index.Member, index.Score);
    }

    /// <summary>
    /// Only-advance targeted upsert (#89): behaves like <see cref="UpsertFlagAsync"/> but guarded by
    /// the env flag index score (already the UpdatedAt-unix-ms version register every normal upsert
    /// maintains) so a stale write can never revert a fresher legacy value + index entry. This is
    /// used ONLY by the backfiller's targeted per-DC writes
    /// (<see cref="Application.Caches.ICacheService"/> callers via the composite cache's
    /// UpsertFlagToDcAsync) — the normal broadcast <see cref="UpsertFlagAsync"/> stays unconditional.
    /// </summary>
    public async Task<bool> UpsertFlagIfNewerAsync(FeatureFlag flag)
    {
        var cache = RedisCaches.Flag(flag);
        var index = RedisCaches.FlagIndex(flag);

        var result = await Redis.ScriptEvaluateAsync(
            OnlyAdvanceIndexedUpsertScript,
            [cache.Key, index.Key],
            [cache.Value, index.Member, index.Score]);

        // #105: OnlyAdvanceIndexedUpsertScript already returns 1/0 (wrote the value key or not) —
        // surface it instead of discarding it, so callers (the DC backfiller) can tell a
        // genuinely guard-rejected write from one that landed.
        return (int)result == 1;
    }

    /// <summary>
    /// Stages a new flag version (B1 stage/commit storage). Writes ONLY the versioned value key
    /// <c>featbit:flag:{id}:v{ts}</c>; it does NOT move the committed pointer and does NOT touch
    /// the env flag sorted-set index. The previously committed value therefore stays readable
    /// until <see cref="CommitFlagAsync"/> is called.
    /// </summary>
    public async Task<bool> StageFlagAsync(FeatureFlag flag, long ts)
    {
        var staged = RedisCaches.FlagStaged(flag, ts);
        // #105: StringSetAsync already returns whether the SET succeeded — surface it instead of
        // discarding it. Staging is unconditional (no version register to guard against), so this
        // is true in practice unless the underlying write throws.
        return await Redis.StringSetAsync(staged.Key, staged.Value);
    }

    /// <summary>
    /// Commits a previously staged flag version (B1 stage/commit storage). Sets the committed
    /// pointer <c>featbit:flag-committed:{id}</c> to <paramref name="ts"/> AND advances the env
    /// flag sorted-set index score to <paramref name="ts"/> (mirroring <see cref="UpsertFlagAsync"/>'s
    /// index logic), making the staged version the authoritative committed value.
    ///
    /// Only-advance guarded (#89): both the pointer flip and the index score use only-advance
    /// semantics, so a call with a <paramref name="ts"/> that is not strictly newer than what's
    /// already committed is a no-op — this is what stops a DC cache backfill holding a stale
    /// snapshot from reverting a fresher pointer a racing normal commit already wrote. The normal
    /// coordinator commit path always calls this with a strictly increasing <paramref name="ts"/>
    /// (enforced by its own monotonicity check before broadcasting), so the guard never fires there.
    /// </summary>
    public async Task<bool> CommitFlagAsync(Guid envId, string flagId, long ts)
    {
        // flip the committed pointer to the staged version, but only if it advances
        var pointerKey = RedisCaches.FlagCommittedPointer(Guid.Parse(flagId));
        var pointerResult = await Redis.ScriptEvaluateAsync(OnlyAdvancePointerScript, [pointerKey], [ts]);
        var accepted = (int)pointerResult == 1;

        // advance the env flag index score (mirror UpsertFlag index logic); ZADD GT is Redis's
        // native only-advance primitive for a sorted-set score (Redis 6.2+; still adds new members).
        // #105: its own bool return means "was a NEW member added", not "did the score advance" —
        // an existing member's score update via GT returns false even when it genuinely raised the
        // score (Redis only counts newly-added members unless the CH flag is set). It is therefore
        // NOT a reliable accept signal here; the pointer flip above is the authoritative one.
        var indexKey = RedisKeys.FlagIndex(envId);
        await Redis.SortedSetAddAsync(indexKey, flagId, ts, SortedSetWhen.GreaterThan);

        return accepted;
    }

    /// <summary>
    /// Probes whether this Redis holds the staged version value key
    /// <c>featbit:flag:{id}:v{ts}</c> (B1 stage/commit storage).
    /// </summary>
    public Task<bool> HasStagedFlagAsync(Guid id, long ts)
    {
        return Redis.KeyExistsAsync(RedisCaches.FlagVersion(id, ts));
    }

    public async Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
        // delete index first
        var index = RedisKeys.FlagIndex(envId);
        await Redis.SortedSetRemoveAsync(index, flagId.ToString());

        // delete cache
        var cacheKey = RedisKeys.Flag(flagId);
        await Redis.KeyDeleteAsync(cacheKey);
    }

    public async Task UpsertSegmentAsync(ICollection<Guid> envIds, Segment segment)
    {
        // upsert cache
        var cache = RedisCaches.Segment(segment);
        await Redis.StringSetAsync(cache.Key, cache.Value);

        // upsert index
        foreach (var envId in envIds)
        {
            var index = RedisCaches.SegmentIndex(envId, segment);
            await Redis.SortedSetAddAsync(index.Key, index.Member, index.Score);
        }
    }

    /// <summary>
    /// Only-advance targeted upsert (#89, segment counterpart of <see cref="UpsertFlagIfNewerAsync"/>):
    /// behaves like <see cref="UpsertSegmentAsync"/> but guarded by the MAX score across EVERY env's
    /// segment index as the version register (see <see cref="OnlyAdvanceIndexedUpsertScript"/> for the
    /// full invariant), so the value key can never be reverted by a write that isn't strictly newer
    /// than what ANY of the segment's envs already has, while each env's own index is still free to
    /// independently catch up (per-key GT) even on a call whose value write a *different*, fresher env
    /// blocked. Used ONLY by the backfiller's targeted per-DC writes; the normal broadcast
    /// <see cref="UpsertSegmentAsync"/> stays unconditional. If <paramref name="envIds"/> is empty
    /// there is no index to use as a version register, so this falls back to the unconditional write
    /// (matching pre-#89 behavior for that edge case).
    /// </summary>
    public async Task<bool> UpsertSegmentIfNewerAsync(ICollection<Guid> envIds, Segment segment)
    {
        if (envIds.Count == 0)
        {
            // No index to use as a version register: fall back to the unconditional write
            // (matching pre-#89 behavior for that edge case), which always "accepts".
            await UpsertSegmentAsync(envIds, segment);
            return true;
        }

        var cache = RedisCaches.Segment(segment);
        var member = segment.Id.ToString();
        var score = new DateTimeOffset(segment.UpdatedAt).ToUnixTimeMilliseconds();

        var keys = new RedisKey[1 + envIds.Count];
        keys[0] = cache.Key;
        var i = 1;
        foreach (var envId in envIds)
        {
            keys[i++] = RedisKeys.SegmentIndex(envId);
        }

        var result = await Redis.ScriptEvaluateAsync(
            OnlyAdvanceIndexedUpsertScript,
            keys,
            [cache.Value, member, score]);

        // #105: surface the script's 1/0 "wrote the value key" result instead of discarding it.
        return (int)result == 1;
    }

    /// <summary>
    /// Stages a new segment version (B2 stage/commit storage, mirroring <see cref="StageFlagAsync"/>).
    /// Writes ONLY the versioned value key <c>featbit:segment:{id}:v{ts}</c>; it does NOT move the
    /// committed pointer and does NOT touch any env segment sorted-set index. The previously
    /// committed value therefore stays readable until <see cref="CommitSegmentAsync"/> is called.
    /// </summary>
    public async Task<bool> StageSegmentAsync(Segment segment, long ts)
    {
        var staged = RedisCaches.SegmentStaged(segment, ts);
        // #105: mirrors StageFlagAsync's return-value semantics.
        return await Redis.StringSetAsync(staged.Key, staged.Value);
    }

    /// <summary>
    /// Commits a previously staged segment version (B2 stage/commit storage, mirroring
    /// <see cref="CommitFlagAsync"/>). Sets the committed pointer
    /// <c>featbit:segment-committed:{id}</c> to <paramref name="ts"/> AND advances the segment
    /// sorted-set index score to <paramref name="ts"/> for each env in <paramref name="envIds"/>
    /// (segments can belong to multiple envs, mirroring <see cref="UpsertSegmentAsync"/>'s index
    /// logic), making the staged version the authoritative committed value.
    ///
    /// Only-advance guarded (#89, mirrors <see cref="CommitFlagAsync"/>): both the pointer flip and
    /// every env's index score use only-advance semantics, so a stale <paramref name="ts"/> is a
    /// no-op and can never revert a fresher committed segment pointer. The normal coordinator commit
    /// path always advances <paramref name="ts"/>, so the guard never fires there.
    /// </summary>
    public async Task<bool> CommitSegmentAsync(ICollection<Guid> envIds, string segmentId, long ts)
    {
        // flip the committed pointer to the staged version, but only if it advances
        var pointerKey = RedisCaches.SegmentCommittedPointer(Guid.Parse(segmentId));
        var pointerResult = await Redis.ScriptEvaluateAsync(OnlyAdvancePointerScript, [pointerKey], [ts]);
        var accepted = (int)pointerResult == 1;

        // advance the segment index score for each env (mirror UpsertSegment index logic); ZADD GT
        // is Redis's native only-advance primitive for a sorted-set score. #105: as in
        // CommitFlagAsync, each ZADD's own bool return is a "new member" signal, not "score
        // advanced", so it is not used as the accept signal — the pointer flip above is.
        foreach (var envId in envIds)
        {
            var indexKey = RedisKeys.SegmentIndex(envId);
            await Redis.SortedSetAddAsync(indexKey, segmentId, ts, SortedSetWhen.GreaterThan);
        }

        return accepted;
    }

    /// <summary>
    /// Probes whether this Redis holds the staged version value key
    /// <c>featbit:segment:{id}:v{ts}</c> (B2 stage/commit storage, mirroring
    /// <see cref="HasStagedFlagAsync"/>).
    /// </summary>
    public Task<bool> HasStagedSegmentAsync(Guid id, long ts)
    {
        return Redis.KeyExistsAsync(RedisCaches.SegmentVersion(id, ts));
    }

    public async Task DeleteSegmentAsync(ICollection<Guid> envIds, Guid segmentId)
    {
        // delete index first
        foreach (var envId in envIds)
        {
            var index = RedisKeys.SegmentIndex(envId);
            await Redis.SortedSetRemoveAsync(index, segmentId.ToString());
        }

        // delete cache
        var cacheKey = RedisKeys.Segment(segmentId);
        await Redis.KeyDeleteAsync(cacheKey);
    }

    public async Task UpsertLicenseAsync(Workspace workspace)
    {
        var key = RedisKeys.License(workspace.Id);
        var value = workspace.License;

        await Redis.StringSetAsync(key, value);
    }

    public async Task UpsertSecretAsync(ResourceDescriptor resourceDescriptor, Secret secret)
    {
        var key = RedisKeys.Secret(secret.Value);

        var organization = resourceDescriptor.Organization;
        var project = resourceDescriptor.Project;
        var environment = resourceDescriptor.Environment;

        var fields = new HashEntry[]
        {
            new("type", secret.Type),
            new("organizationId", organization.Id.ToString()),
            new("organizationKey", organization.Key),
            new("projectId", project.Id.ToString()),
            new("projectKey", project.Key),
            new("envId", environment.Id.ToString()),
            new("envKey", environment.Key)
        };

        await Redis.HashSetAsync(key, fields);
    }

    public async Task DeleteSecretAsync(Secret secret)
    {
        var key = RedisKeys.Secret(secret.Value);

        await Redis.KeyDeleteAsync(key);
    }

    public async Task<string> GetOrSetLicenseAsync(Guid workspaceId, Func<Task<string>> licenseGetter)
    {
        var key = RedisKeys.License(workspaceId);
        if (await Redis.KeyExistsAsync(key))
        {
            var value = await Redis.StringGetAsync(key);
            return value.ToString();
        }

        var license = await licenseGetter();
        await Redis.StringSetAsync(key, license);
        return license;
    }

    public async Task UpsertConnectionMadeAsync(ConnectionMessage connectionMessage)
    {
        var fields = new HashEntry[]
        {
            new("id", connectionMessage.Id),
            new("envId", connectionMessage.EnvId.ToString()),
            new("secret", connectionMessage.Secret),
            new("heartbeatId", connectionMessage.HeartbeatId)
        };

        await Redis.HashSetAsync(RedisKeys.Connection(connectionMessage.Id), fields);
    }

    public async Task DeleteConnectionMadeAsync(ConnectionMessage connectionMessage)
    {
        await Redis.KeyDeleteAsync(RedisKeys.Connection(connectionMessage.Id));
    }

    public async Task UpsertPodHeartbeat(HealthMessage healthMessage)
    {
        var value = JsonSerializer.Serialize(healthMessage);
        await Redis.HashSetAsync(RedisKeys.Heartbeats, healthMessage.PodId, value);
    }

    public async Task DeletePodConnection(Guid podId)
    {
        await Redis.HashDeleteAsync(RedisKeys.Heartbeats, podId.ToString());

        await DeletePodClients(podId);
    }

    public async Task<List<HealthMessage>> GetAllHealthMessages()
    {
        var entries = await Redis.HashGetAllAsync(RedisKeys.Heartbeats);

        var result = new List<HealthMessage>(entries.Length);
        foreach (var entry in entries)
        {
            if (!entry.Value.HasValue)
            {
                continue;
            }

            var message = JsonSerializer.Deserialize<HealthMessage>((string)entry.Value!);
            if (message is not null)
            {
                result.Add(message);
            }
        }

        return result;
    }

    private async Task DeletePodClients(Guid heartbeatId)
    {
        var heartbeatIdString = heartbeatId.ToString();
        var connectionKeys = new List<RedisKey>();

        foreach (var endPoint in redis.Connection.GetEndPoints())
        {
            var server = redis.Connection.GetServer(endPoint);
            if (server.IsReplica)
            {
                continue;
            }

            await foreach (var key in server.KeysAsync(pattern: RedisKeys.ConnectionPattern, pageSize: 250))
            {
                connectionKeys.Add(key);
            }
        }

        if (connectionKeys.Count == 0)
        {
            return;
        }

        var heartbeatLookups = connectionKeys
            .Select(key => Redis.HashGetAsync(key, "heartbeatId"))
            .ToArray();

        var heartbeatValues = await Task.WhenAll(heartbeatLookups);

        var connectionsToRemove = connectionKeys
            .Zip(heartbeatValues, (key, value) => (Key: key, Value: value))
            .Where(x => x.Value.HasValue && x.Value == heartbeatIdString)
            .Select(x => x.Key)
            .ToArray();

        if (connectionsToRemove.Length > 0)
        {
            await Redis.KeyDeleteAsync(connectionsToRemove);
        }
    }
}