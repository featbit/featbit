using System.Diagnostics.Metrics;
using Domain.Observability;
using Infrastructure.Caches.Redis;
using StackExchange.Redis;

namespace Api.Application.ControlPlane;

/// <summary>
/// #71a (sub-issue of #71, blocks #71b): Redis-based leader election so the gated-commit consistency
/// workers (<see cref="CommitCoordinatorWorker"/>, <see cref="RecoveryWorker"/>,
/// <see cref="DcIdConsistencyChecker"/> — gated in #71b) run on exactly one control-plane replica at a
/// time. Election is an optimization, NOT a correctness mechanism: every operation those workers
/// perform is idempotent + version-guarded, so losing leadership mid-tick is harmless (at worst
/// redundant work) and no fencing tokens are needed — a TTL lock with a cached flag is sufficient.
///
/// The lock lives in <c>Redis:Instances[0]</c> (the "home" Redis, already registered as the singleton
/// <see cref="IRedisClient"/> — see
/// <see cref="Api.Infrastructure.Caches.CacheServiceCollectionExtensions"/>); replicas share
/// configuration, so this is a single lock across replicas, and instance[0] being down already stalls
/// the commit pipeline, so the lock adds no new failure mode.
///
/// Pattern follows <see cref="RedisPopulatingService"/>: StackExchange
/// <c>LockTakeAsync</c>/<c>LockExtendAsync</c>/<c>LockReleaseAsync</c> with a Guid lock value (this
/// instance's <see cref="InstanceId"/>).
///
/// Loop (tick-loop shape mirrors <see cref="RecoveryWorker"/>): attempt to acquire/renew immediately on
/// start, then on every tick of a <see cref="PeriodicTimer"/> at the renew interval. Not leader ->
/// <c>LockTakeAsync</c>; leader -> <c>LockExtendAsync</c>, dropping to not-leader (Warning log) on
/// failure. ANY Redis exception drops to not-leader and is logged; the next tick retries — the
/// underlying connection is <c>abortConnect=false</c> and self-heals.
///
/// Graceful shutdown (<see cref="StopAsync"/>): if leader, the lock is released immediately so failover
/// does not wait out the TTL.
///
/// #71 leader election is opt-in, default off (<c>ControlPlane:LeaderElection:Enabled</c>): this
/// type is only constructed/registered when enabled (see
/// <see cref="Api.Setup.ServicesRegister.AddLeaderElection"/>) — election only earns its keep with
/// MULTIPLE replicas of one control-plane deployment sharing a single commit pipeline; for the
/// default single-replica case it only adds a stall surface (a transient Redis blip flips a lone
/// instance to not-leader and its gated workers skip ticks) for zero benefit. When disabled,
/// <see cref="AlwaysLeaderElection"/> is registered instead, so every instance runs — safe
/// (idempotent/version guards, see above) but redundant under multiple replicas. When enabled, it
/// runs in BOTH consistency modes (no <c>_enabled</c> gate of its own) — it is cheap, and only the
/// #71b-gated workers will consult <see cref="IsLeader"/>.
///
/// Metric: <see cref="IsLeaderGaugeName"/> (0/1) on the shared
/// <see cref="CommitCoordinatorWorker.MeterName"/> meter. Unlike the workers' static gauges, this
/// one is registered on a Meter instance OWNED by this object (not static): multiple electors can
/// exist in the same process (e.g. integration tests exercising two competing instances), and each
/// must report its OWN leadership state rather than clobbering a shared static flag. That
/// instance-owned Meter is also how a caller distinguishes two electors now that the gauge carries
/// no <c>instance_id</c> tag — listen per Meter instance, not per tag.
/// </summary>
public sealed partial class RedisLeaderElector : BackgroundService, ILeaderElection
{
    /// <summary>
    /// Default lock TTL when not overridden via <c>ControlPlane:LeaderElection:TtlSeconds</c>.
    /// </summary>
    public static readonly TimeSpan DefaultTtl = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Default interval between acquire/renew attempts when not overridden via
    /// <c>ControlPlane:LeaderElection:RenewIntervalSeconds</c>. Roughly TTL/3 by default so a renew
    /// tick has multiple chances to succeed before the lock expires.
    /// </summary>
    public static readonly TimeSpan DefaultRenewInterval = TimeSpan.FromSeconds(10);

    /// <summary>
    /// The single cross-replica lock key. Its value is the holder's <see cref="InstanceId"/>.
    /// </summary>
    public const string LockKey = "featbit:control-plane:leader";

    /// <summary>
    /// Observable gauge reporting 1 while this instance holds leadership, 0 otherwise.
    /// Carries no attributes: <c>instance_id</c> is banned by the cardinality budget
    /// (docs/observability/index.md §4) and is redundant with the OTel resource attribute
    /// <c>service.instance.id</c>, which already identifies the pod.
    /// </summary>
    public const string IsLeaderGaugeName = "featbit.control_plane.consistency.is_leader";

    private readonly IRedisClient _redisClient;
    private readonly TimeSpan _ttl;
    private readonly TimeSpan _renewInterval;
    private readonly ILogger<RedisLeaderElector> _logger;
    private readonly Meter _meter;
    private readonly ObservableGauge<int> _isLeaderGauge;
    private readonly string _lockValue;

    private readonly WorkerObservability _worker =
        ServiceMeter.ForWorker(ControlPlaneWorkerNames.LeaderElector);

    private volatile bool _isLeader;

    /// <inheritdoc />
    public Guid InstanceId { get; } = Guid.NewGuid();

    /// <inheritdoc />
    public bool IsLeader => _isLeader;

    public RedisLeaderElector(
        IRedisClient redisClient,
        IConfiguration configuration,
        ILogger<RedisLeaderElector> logger)
    {
        _redisClient = redisClient;
        _logger = logger;
        _lockValue = InstanceId.ToString();

        var ttlSeconds = configuration.GetValue<int?>("ControlPlane:LeaderElection:TtlSeconds");
        _ttl = ttlSeconds is > 0 ? TimeSpan.FromSeconds(ttlSeconds.Value) : DefaultTtl;

        var renewSeconds = configuration.GetValue<int?>("ControlPlane:LeaderElection:RenewIntervalSeconds");
        _renewInterval = renewSeconds is > 0
            ? TimeSpan.FromSeconds(renewSeconds.Value)
            : DefaultRenewInterval;

        // Instance-owned Meter (see the type summary for why this is NOT static like the workers'
        // gauges): the same meter NAME is reused so operators still see one logical metric, but the
        // registration and the backing state are per-instance.
        _meter = new Meter(CommitCoordinatorWorker.MeterName);
        _isLeaderGauge = _meter.CreateObservableGauge(
            IsLeaderGaugeName,
            ObserveIsLeader,
            unit: "{leader}",
            description: "1 if this control-plane instance currently holds the leader lock, else 0.");
    }

    private Measurement<int> ObserveIsLeader() => new(_isLeader ? 1 : 0);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var redis = _redisClient.GetDatabase();

        _worker.Started();

        try
        {
            // Attempt immediately on start so a single instance becomes leader without waiting a full
            // renew interval.
            await TryAcquireOrRenewAsync(redis);

            using var timer = new PeriodicTimer(_renewInterval);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                _worker.Heartbeat();
                await TryAcquireOrRenewAsync(redis);
            }
        }
        finally
        {
            _worker.Stopped();
        }
    }

    private async Task TryAcquireOrRenewAsync(IDatabase redis)
    {
        try
        {
            if (!_isLeader)
            {
                var acquired = await redis.LockTakeAsync(LockKey, _lockValue, _ttl);
                if (acquired)
                {
                    _isLeader = true;
                    ControlPlaneMetrics.Current.RecordLeaderTransition(LeaderTransitionKinds.Acquired);
                    _worker.Success();
                    Log.LeadershipAcquired(_logger, InstanceId);
                }
                else
                {
                    Log.LeadershipNotAcquired(_logger, InstanceId);
                }
            }
            else
            {
                var extended = await redis.LockExtendAsync(LockKey, _lockValue, _ttl);
                if (extended)
                {
                    _worker.Success();
                    Log.LeadershipRenewed(_logger, InstanceId);
                }
                else
                {
                    _isLeader = false;
                    ControlPlaneMetrics.Current.RecordLeaderTransition(LeaderTransitionKinds.Lost);
                    Log.LeadershipLost(_logger, InstanceId);
                }
            }
        }
        catch (Exception ex)
        {
            var wasLeader = _isLeader;
            _isLeader = false;

            // Recorded only when leadership was actually surrendered. A Redis error while merely
            // *attempting* to acquire changes nothing, so counting it would drown the real signal.
            if (wasLeader)
            {
                ControlPlaneMetrics.Current.RecordLeaderTransition(LeaderTransitionKinds.ErrorDemoted);
            }

            _worker.LoopFailed(ex);
            Log.RedisError(
                _logger,
                InstanceId,
                wasLeader ? "renewing leadership" : "attempting to acquire leadership",
                ex);
        }
    }

    /// <summary>
    /// Graceful shutdown: if this instance is leader, release the lock immediately so failover does
    /// not have to wait out the TTL. Best-effort — a release failure is logged and the lock simply
    /// expires via TTL instead.
    /// </summary>
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);

        if (!_isLeader)
        {
            return;
        }

        try
        {
            var redis = _redisClient.GetDatabase();
            await redis.LockReleaseAsync(LockKey, _lockValue);
            _isLeader = false;
            ControlPlaneMetrics.Current.RecordLeaderTransition(LeaderTransitionKinds.Released);
            Log.LeadershipReleased(_logger, InstanceId);
        }
        catch (Exception ex)
        {
            Log.ErrorReleaseLock(_logger, InstanceId, ex);
        }
    }

    public override void Dispose()
    {
        _meter.Dispose();
        base.Dispose();
    }
}
