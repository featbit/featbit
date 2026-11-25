using Api.Infrastructure.Caches;

namespace Api.Application.ControlPlane;

/// <summary>
/// Thrown by a backfill that may not write a DC's flags and segments because it does not hold the DC's lock, or cannot
/// read what was pruned from the DC. Its callers try again later.
/// </summary>
public sealed class DcLockUnavailableException(string message) : Exception(message);

/// <summary>
/// A lease on one DC's Redis, held by a backfill or a prune of that DC. Disposing it releases the lock. It also gives
/// access to the DC's shared record of what prunes removed and when, which every replica reads and writes.
/// </summary>
public interface IDcLease : IAsyncDisposable
{
    /// <summary>
    /// Whether the lock is still held. It turns <c>false</c> when the lock could not be taken, when a renewal finds another
    /// holder, and when the last confirmed renewal is older than the TTL minus one renew interval, so that a holder stops
    /// before its lock can expire and be taken by another replica, not after.
    /// </summary>
    bool IsHeld { get; }

    /// <summary>
    /// Records in the DC's Redis that a prune is removing <paramref name="id"/> at <paramref name="at"/>. Returns
    /// <c>false</c> if it could not be recorded, in which case the entry must not be removed.
    /// </summary>
    Task<bool> RecordPrunedAsync(Guid id, DateTimeOffset at);

    /// <summary>
    /// Reads what prunes on any replica removed from the DC, and when, forgetting what was removed before
    /// <paramref name="forgetBefore"/>. Returns <c>null</c> if the record cannot be read: an unreadable record is not an
    /// empty one, and a backfill must not write from a snapshot without it.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, DateTimeOffset>?> ReadPrunedAsync(DateTimeOffset forgetBefore);
}

/// <summary>
/// Keeps a backfill and a prune of the same DC from running at the same time across control-plane replicas, and shares
/// what prunes removed. A prune removes an entry together with the index score that makes the only-advance guard reject an
/// older write, so a backfill working from a snapshot read before the delete would write the entry back, whether it ran
/// alongside the prune on another replica or after it. The lock keeps them apart; the shared record lets the backfill
/// skip what was pruned after its snapshot was read. The in-process gate and markers in <see cref="DcBackfiller"/> cover
/// one process; this covers all of them.
/// </summary>
public interface IDcMutationLock
{
    /// <summary>
    /// Waits until the lock for <paramref name="dcId"/> is free and takes it. If the lock cannot be used (an unknown DC,
    /// or a Redis error), it logs and returns a lease whose <see cref="IDcLease.IsHeld"/> is <c>false</c>; the caller
    /// then must not change the DC's flags or segments.
    /// </summary>
    Task<IDcLease> AcquireAsync(string dcId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Takes the lock for <paramref name="dcId"/> if it is free. Returns <c>null</c> if another holder has it, or if the
    /// lock cannot be used.
    /// </summary>
    Task<IDcLease?> TryAcquireAsync(string dcId, CancellationToken cancellationToken = default);
}

/// <summary>
/// <see cref="IDcMutationLock"/> backed by a key in the DC's own Redis, taken with <c>SET NX</c> and a random token
/// (StackExchange.Redis <c>LockTake</c>), renewed while held, and released only by its holder. The key lives in the Redis
/// being changed, so every replica that can change that DC sees the same lock.
/// </summary>
public sealed class RedisDcMutationLock(
    IReadOnlyList<DcRedisConnection> connections,
    ILogger<RedisDcMutationLock> logger,
    TimeSpan? ttl = null,
    TimeSpan? renewInterval = null,
    TimeSpan? pollInterval = null) : IDcMutationLock
{
    private readonly TimeSpan _ttl = ttl ?? TimeSpan.FromSeconds(60);
    private readonly TimeSpan _renewInterval = renewInterval ?? TimeSpan.FromSeconds(15);
    private readonly TimeSpan _pollInterval = pollInterval ?? TimeSpan.FromMilliseconds(500);
    private readonly ILogger _logger = logger;

    public static string LockKey(string dcId) => $"featbit:control-plane:dc-mutation-lock:{dcId}";

    /// <summary>A hash of what prunes removed from the DC: field = the flag or segment id, value = unix ms.</summary>
    public static string PrunedKey(string dcId) => $"featbit:control-plane:pruned:{dcId}";

    public async Task<IDcLease> AcquireAsync(string dcId, CancellationToken cancellationToken = default)
    {
        var connection = Find(dcId);
        if (connection is null)
        {
            return NotHeld.Instance;
        }

        var token = Guid.NewGuid().ToString("N");
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                var attemptedAt = Environment.TickCount64;
                if (await connection.Client.GetDatabase().LockTakeAsync(LockKey(dcId), token, _ttl))
                {
                    return new Lease(this, connection, dcId, token, attemptedAt);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(
                    ex, "DC lock: could not take the lock for DC {DcId}.", dcId);
                return NotHeld.Instance;
            }

            await Task.Delay(_pollInterval, cancellationToken);
        }
    }

    public async Task<IDcLease?> TryAcquireAsync(string dcId, CancellationToken cancellationToken = default)
    {
        var connection = Find(dcId);
        if (connection is null)
        {
            return null;
        }

        var token = Guid.NewGuid().ToString("N");
        try
        {
            var attemptedAt = Environment.TickCount64;
            return await connection.Client.GetDatabase().LockTakeAsync(LockKey(dcId), token, _ttl)
                ? new Lease(this, connection, dcId, token, attemptedAt)
                : null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "DC lock: could not take the lock for DC {DcId}.", dcId);
            return null;
        }
    }

    private DcRedisConnection? Find(string dcId)
    {
        var connection = connections.FirstOrDefault(c => c.DcId == dcId);
        if (connection is null)
        {
            _logger.LogWarning("DC lock: no Redis connection for DC {DcId}.", dcId);
        }

        return connection;
    }

    private sealed class NotHeld : IDcLease
    {
        public static readonly NotHeld Instance = new();

        public bool IsHeld => false;

        public Task<bool> RecordPrunedAsync(Guid id, DateTimeOffset at) => Task.FromResult(false);

        public Task<IReadOnlyDictionary<Guid, DateTimeOffset>?> ReadPrunedAsync(DateTimeOffset forgetBefore) =>
            Task.FromResult<IReadOnlyDictionary<Guid, DateTimeOffset>?>(null);

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }

    private sealed class Lease : IDcLease
    {
        private readonly RedisDcMutationLock _owner;
        private readonly DcRedisConnection _connection;
        private readonly string _dcId;
        private readonly string _token;
        private readonly CancellationTokenSource _stop = new();
        private readonly Task _renewing;
        private volatile bool _held = true;

        // When the lock was last known to be held for a full TTL from then on: the start of the take or extension that
        // succeeded (Environment.TickCount64, so a wall-clock change does not move it).
        private long _confirmedAt;

        public Lease(RedisDcMutationLock owner, DcRedisConnection connection, string dcId, string token, long takenAt)
        {
            _owner = owner;
            _connection = connection;
            _dcId = dcId;
            _token = token;
            _confirmedAt = takenAt;
            _renewing = Task.Run(RenewAsync);
        }

        // Held until a renewal finds another holder, and only while the lock has more than one renew interval left before
        // it could expire, so a holder whose renewals fail stops before another replica can take the lock.
        public bool IsHeld =>
            _held && Environment.TickCount64 - Interlocked.Read(ref _confirmedAt)
            < (_owner._ttl - _owner._renewInterval).TotalMilliseconds;

        public async Task<bool> RecordPrunedAsync(Guid id, DateTimeOffset at)
        {
            try
            {
                await _connection.Client.GetDatabase()
                    .HashSetAsync(PrunedKey(_dcId), id.ToString(), at.ToUnixTimeMilliseconds());
                return true;
            }
            catch (Exception ex)
            {
                _owner._logger.LogWarning(
                    ex, "DC lock: could not record that {Id} was pruned from DC {DcId}.", id, _dcId);
                return false;
            }
        }

        public async Task<IReadOnlyDictionary<Guid, DateTimeOffset>?> ReadPrunedAsync(DateTimeOffset forgetBefore)
        {
            var result = new Dictionary<Guid, DateTimeOffset>();
            try
            {
                var db = _connection.Client.GetDatabase();
                var stale = new List<StackExchange.Redis.RedisValue>();
                foreach (var entry in await db.HashGetAllAsync(PrunedKey(_dcId)))
                {
                    if (!Guid.TryParse(entry.Name.ToString(), out var id) || !entry.Value.TryParse(out long ms))
                    {
                        stale.Add(entry.Name);
                        continue;
                    }

                    var at = DateTimeOffset.FromUnixTimeMilliseconds(ms);
                    if (at < forgetBefore)
                    {
                        stale.Add(entry.Name);
                        continue;
                    }

                    result[id] = at;
                }

                if (stale.Count > 0)
                {
                    await db.HashDeleteAsync(PrunedKey(_dcId), stale.ToArray());
                }
            }
            catch (Exception ex)
            {
                _owner._logger.LogWarning(
                    ex, "DC lock: could not read what was pruned from DC {DcId}.", _dcId);
                return null;
            }

            return result;
        }

        // Extends the lock while it is held. The lock is taken to be lost when an extension finds another holder, or when
        // extensions keep failing until the TTL since the last good one has passed.
        private async Task RenewAsync()
        {
            while (!_stop.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(_owner._renewInterval, _stop.Token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }

                try
                {
                    var attemptedAt = Environment.TickCount64;
                    if (await _connection.Client.GetDatabase().LockExtendAsync(LockKey(_dcId), _token, _owner._ttl))
                    {
                        Interlocked.Exchange(ref _confirmedAt, attemptedAt);
                        continue;
                    }

                    _owner._logger.LogWarning("DC lock: the lock for DC {DcId} was lost.", _dcId);
                    _held = false;
                    return;
                }
                catch (Exception ex)
                {
                    if (Environment.TickCount64 - Interlocked.Read(ref _confirmedAt) >= _owner._ttl.TotalMilliseconds)
                    {
                        _owner._logger.LogWarning(
                            ex, "DC lock: the lock for DC {DcId} could not be renewed and may have expired.", _dcId);
                        _held = false;
                        return;
                    }
                }
            }
        }

        public async ValueTask DisposeAsync()
        {
            await _stop.CancelAsync();
            await _renewing;
            _stop.Dispose();

            if (!_held)
            {
                return;
            }

            _held = false;
            try
            {
                await _connection.Client.GetDatabase().LockReleaseAsync(LockKey(_dcId), _token);
            }
            catch (Exception ex)
            {
                // It expires on its own after the TTL.
                _owner._logger.LogWarning(ex, "DC lock: could not release the lock for DC {DcId}.", _dcId);
            }
        }
    }
}
