using System.Reflection;
using Api.Application.ControlPlane;
using Api.Authentication;
using Api.Infrastructure.Caches;
using Api.Infrastructure.MQ;
using Api.Infrastructure.Persistence;
using Api.Setup.OpenApi;
using Application.Bases.Behaviours;
using Application.Segments;
using Application.Services;
using Infrastructure;
using Infrastructure.AppService;
using MediatR;
using Microsoft.AspNetCore.Authentication;
using Microsoft.OpenApi;
using Serilog;

namespace Api.Setup;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        builder.Services.AddSerilog((_, lc) => ConfigureSerilog.Configure(lc, builder.Configuration));
        builder.Services.AddOpenApi("v1", options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info = new OpenApiInfo
                {
                    Title = "Featbit Control Plane",
                    Version = "v1"
                };
                return Task.CompletedTask;
            });
    
            options.AddDocumentTransformer<ApiKeySecuritySchemeTransformer>();
        });
        builder.Services.AddControllers();
        builder.Services.AddCache(builder.Configuration);
        builder.Services.AddTransient<IFeatureFlagAppService, FeatureFlagAppService>();
        builder.Services.AddDbSpecificServices(builder.Configuration);
        builder.Services.AddMq(builder.Configuration);
        builder.Services.AddTransient<ISegmentMessageService, SegmentMessageService>();

        builder.Services.AddHealthChecks().AddReadinessChecks(builder.Configuration);
        
        builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
        builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));    
        builder.Services.AddAuthentication("ApiKey")
            .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>("ApiKey", options => { });

        builder.Services.Configure<PodHealthOptions>(
            builder.Configuration.GetSection(PodHealthOptions.SectionName));
        builder.Services.AddHostedService<PodHealthChecker>();

        // #71 leader election: single-active gating for the gated-commit workers (#71b consumes
        // ILeaderElection). Opt-in, default off — see AddLeaderElection below for the rationale.
        AddLeaderElection(builder.Services, builder.Configuration);

        // C3b-2 commit coordinator: gated-commit reconciliation of pending flag changes. No-ops
        // unless ControlPlane:ConsistencyMode == GatedCommit (checked inside the worker).
        builder.Services.AddHostedService<CommitCoordinatorWorker>();

        // Backfills one DC's Redis from the source of truth (Mongo/Postgres) using the write path for
        // the active consistency mode, then triggers a per-DC client refresh. Shared by RecoveryWorker
        // (GatedCommit/lease trigger) and CacheReconciler (mode-agnostic/Redis-link trigger).
        builder.Services.AddSingleton<IDcBackfiller, DcBackfiller>();

        // E1 returning-DC recovery: backfills a DC's Redis with all committed flag values when its
        // lease returns to the live set. No-ops unless ControlPlane:ConsistencyMode == GatedCommit.
        builder.Services.AddHostedService<RecoveryWorker>();

        // Cache self-heal for every DC (local + peers): when a DC's Redis link becomes reachable
        // (control-plane startup, or a reconnect after the link was down during changes), rebuilds
        // that DC's cache from the source of truth so it doesn't stay stale. The local entry lets a
        // cluster self-heal its own cache even when the peer is down (the api-server populate guard
        // skips on a compute-only restart). Runs in BOTH consistency modes; disable via
        // ControlPlane:CacheReconcile:Enabled=false.
        builder.Services.AddHostedService<CacheReconciler>();

        // #48 advisory DcId consistency check: warns (never fails) when the configured Redis DcId set
        // and the reporting ELS lease DcId set diverge. No-ops unless ConsistencyMode == GatedCommit.
        builder.Services.AddHostedService<DcIdConsistencyChecker>();

        return builder;
    }

    /// <summary>
    /// #71 leader election is opt-in, default off (<c>ControlPlane:LeaderElection:Enabled</c>).
    /// Election only earns its keep when MULTIPLE replicas of one control-plane deployment share a
    /// single commit pipeline; in the default single-replica case it only adds a stall surface (a
    /// transient Redis blip flips a lone instance to not-leader and its gated workers skip ticks)
    /// for zero benefit, since running without election is safe-but-redundant by construction — the
    /// gated workers' operations are idempotent/version-guarded (see
    /// <see cref="RedisLeaderElector"/>'s class doc) — matching the codebase's existing opt-in
    /// convention (<c>ConsistencyMode</c> itself defaults to <c>BestEffort</c>).
    ///
    /// Disabled (default): <see cref="AlwaysLeaderElection"/> is registered as
    /// <see cref="ILeaderElection"/> (always reports leadership, so every instance just runs every
    /// tick) and as a hosted service (logs a one-line discoverability hint at startup).
    /// <see cref="RedisLeaderElector"/> and its hosted service are NOT registered at all.
    ///
    /// Enabled: exactly today's three registrations — <see cref="RedisLeaderElector"/> as a
    /// singleton, exposed both as <see cref="ILeaderElection"/> and as a hosted service so all three
    /// resolve the SAME instance.
    /// </summary>
    internal static void AddLeaderElection(IServiceCollection services, IConfiguration configuration)
    {
        var enabled = configuration.GetValue<bool>("ControlPlane:LeaderElection:Enabled");

        if (enabled)
        {
            services.AddSingleton<RedisLeaderElector>();
            services.AddSingleton<ILeaderElection>(sp => sp.GetRequiredService<RedisLeaderElector>());
            services.AddHostedService(sp => sp.GetRequiredService<RedisLeaderElector>());
        }
        else
        {
            services.AddSingleton<AlwaysLeaderElection>();
            services.AddSingleton<ILeaderElection>(sp => sp.GetRequiredService<AlwaysLeaderElection>());
            services.AddHostedService(sp => sp.GetRequiredService<AlwaysLeaderElection>());
        }
    }
}