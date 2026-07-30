using Api.Authentication;
using Api.ControlPlane;
using Api.Cors;
using Api.RateLimiting;
using Api.Services;
using Domain.ControlPlane;
using Domain.Shared;
using Domain.Shared.Authentication;
using Domain.Workspaces;
using Infrastructure;
using Infrastructure.Services;
using Infrastructure.Store;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Serilog;
using Streaming;
using Streaming.Connections;
using Streaming.DependencyInjection;
using Streaming.ControlPlane;

namespace Api.Setup;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        services.AddControllers();

        // serilog
        builder.Services.AddSerilog((_, lc) => ConfigureSerilog.Configure(lc, builder.Configuration));

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        // health check dependencies
        var healthChecks = services.AddHealthChecks().AddReadinessChecks(configuration);

        // cors
        builder.AddCustomCors();

        // authentication and authorization
        services.AddAuthentication(FeatBitAuthScheme.Name)
            .AddScheme<AuthenticationSchemeOptions, FeatBitAuthHandler>(FeatBitAuthScheme.Name, _ => { });

        var requireAuthPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(requireAuthPolicy);

        // token validator (v1 structural validation only; store lookup added in PR 2)
        services.AddSingleton<ITokenValidator, TokenValidator>();

        // add bounded memory cache
        services.AddSingleton<BoundedMemoryCache>();

        // streaming services
        services
            .AddStreamingCore(options => configuration.GetSection(StreamingOptions.Streaming).Bind(options))
            .UseStore(configuration)
            .UseMq(configuration);

        // rate limiting
        if (configuration.IsRateLimitingEnabled())
        {
            builder.AddRateLimiting();
        }

        // application services
        LicenseVerifier.ImportPublicKey(configuration["PublicKey"]);
        services.AddTransient<IRelayProxyAppService, RelayProxyAppService>();
        services.AddTransient<IFeatureFlagService, FeatureFlagService>();

        if (configuration.UseControlPlane())
        {
            // Replace the `DefaultConnectionManager` with `ControlPlaneConnectionManager`
            services.Replace(ServiceDescriptor.Singleton<IConnectionManager, ControlPlaneConnectionManager>());

            // Replace the `RedisStore` with `GatedCommitRedisStore` if the consistency mode is set to GatedCommit
            if (configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit)
            {
                var count = services.Count;
                for (var i = 0; i < count; i++)
                {
                    var descriptor = services[i];
                    if (descriptor.ServiceType == typeof(IDbStore) && descriptor.ImplementationType == typeof(RedisStore))
                    {
                        services.RemoveAt(i);
                        break;
                    }
                }

                services.Add(ServiceDescriptor.Transient<IDbStore, GatedCommitRedisStore>());
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
            services.AddSingleton<IAppliedWatermarkReader, RedisAppliedWatermarkReader>();

            // D5 (#22): shared singleton recording the last successful heartbeat publish, plus the
            // freshness health check that surfaces an Unhealthy self-fence signal under GatedCommit.
            // Tagged Readiness so it appears on /health/readiness; ASP.NET Core maps Unhealthy -> HTTP
            // 503, so a stale heartbeat under GatedCommit is a HARD fence: the pod fails readiness and
            // is pulled from load-balancer rotation until heartbeats resume.
            services.AddSingleton<IHeartbeatPublishStatus, HeartbeatPublishStatus>();
            healthChecks.AddCheck<HeartbeatFreshnessHealthCheck>(
                "heartbeat-freshness",
                tags: new[] { HealthCheckBuilderExtensions.ReadinessTag });

            services.AddHostedService<HeartbeatService>();
        }

        return builder;
    }
}