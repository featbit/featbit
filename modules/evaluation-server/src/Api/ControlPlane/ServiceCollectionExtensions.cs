using Domain.ControlPlane;
using Domain.Shared;
using Infrastructure;
using Infrastructure.Store;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Streaming.Connections;
using Streaming.ControlPlane;
using Streaming.DependencyInjection;

namespace Api.ControlPlane;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the control-plane services of the evaluation server: the connection manager that reports connections, the
    /// store for the consistency mode, and the heartbeat with its applied-watermark reader. The Redis reader is registered
    /// only under <c>GatedCommit</c>, the one mode in which the control plane uses the watermarks; any other mode gets a reader
    /// that reports none and never touches Redis.
    /// </summary>
    public static IServiceCollection AddControlPlane(this IServiceCollection services, IConfiguration configuration)
    {
        // Replace the `DefaultConnectionManager` with `ControlPlaneConnectionManager`
        services.Replace(ServiceDescriptor.Singleton<IConnectionManager, ControlPlaneConnectionManager>());

        if (configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit)
        {
            // Preserve the database store and replace only the Redis cache store.
            for (var i = 0; i < services.Count; i++)
            {
                var descriptor = services[i];
                if (descriptor.ServiceType == typeof(IDbStore) && descriptor.ImplementationType == typeof(RedisStore))
                {
                    services.RemoveAt(i);
                    break;
                }
            }

            services.AddTransient<IDbStore, GatedCommitRedisStore>();
        }

        // The control-plane topology requires the local DC Redis: the control-plane writes
        // flag/segment changes into per-DC Redis, and the eval server's heartbeat derives the
        // applied watermark from that same Redis via RedisAppliedWatermarkReader. Ensure
        // IRedisClient is registered here so the heartbeat can resolve even when the
        // MqProvider/CacheProvider paths haven't already registered Redis (e.g. MqProvider=Kafka
        // with CacheProvider=None, which is the standard control-plane QA configuration).
        services.TryAddRedis(configuration);

        // Applied watermark reader (per-env, derived on demand from the local DC Redis flag
        // index so all pods in a DC agree and a fresh pod is immediately correct). Only the
        // HeartbeatService consumes this, so registration is gated on UseControlPlane to keep
        // hosts without control-plane wiring from requiring IRedisClient at DI validation time.
        // The control plane turns the watermarks into DC leases only under GatedCommit, so in any
        // other mode the heartbeat reports none instead of scanning Redis to build them.
        if (configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit)
        {
            services.AddSingleton<IAppliedWatermarkReader, RedisAppliedWatermarkReader>();
        }
        else
        {
            services.AddSingleton<IAppliedWatermarkReader, NoOpAppliedWatermarkReader>();
        }

        // D5 (#22): shared singleton recording the last successful heartbeat publish, plus the
        // freshness health check that surfaces an Unhealthy self-fence signal under GatedCommit.
        // Tagged Readiness so it appears on /health/readiness; ASP.NET Core maps Unhealthy -> HTTP
        // 503, so a stale heartbeat under GatedCommit is a HARD fence: the pod fails readiness and
        // is pulled from load-balancer rotation until heartbeats resume.
        services.AddSingleton<IHeartbeatPublishStatus, HeartbeatPublishStatus>();
        services.AddHealthChecks().AddCheck<HeartbeatFreshnessHealthCheck>(
            "heartbeat-freshness",
            tags: new[] { HealthCheckBuilderExtensions.ReadinessTag }
        );

        services.AddHostedService<HeartbeatService>();

        return services;
    }
}
