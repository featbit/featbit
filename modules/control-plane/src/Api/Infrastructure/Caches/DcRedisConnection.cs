using Infrastructure.Caches.Redis;

namespace Api.Infrastructure.Caches;

/// <summary>
/// A configured DC's Redis client paired with its DcId and whether it is the LOCAL DC
/// (<c>Redis:Instances[0]</c>) or a peer. Built in <see cref="CacheServiceCollectionExtensions"/>
/// from every <c>Redis:Instances</c> entry and consumed by
/// <see cref="Api.Application.ControlPlane.CacheReconciler"/> to poll each DC's connection and
/// self-heal that DC's cache from the source of truth on a reachability transition (startup or
/// reconnect). Reuses the SAME <see cref="IRedisClient"/> instance the composite cache writes
/// through, so detection and the backfill writes share one (self-healing) multiplexer per DC.
/// </summary>
public sealed record DcRedisConnection(string DcId, IRedisClient Client, bool IsLocal);
