using Application;
using Application.Insights;
using Application.Usages;
using Domain.Users;
using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Services = Infrastructure.Services;
using AppServices = Infrastructure.AppService;

// ReSharper disable CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;
// ReSharper restore CheckNamespace

public static class ConfigureServices
{
    /// <summary>
    /// Registers the infrastructure services: caches, messaging, identity, the HTTP clients and the database-specific
    /// services.
    /// </summary>
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // caching
        services.AddCache(configuration);

        // flag schedule worker
        services.AddHostedService<AppServices.FlagScheduleWorker>();

        if (configuration.UseControlPlane())
        {
            // staged flag version GC worker (B5): reclaims superseded versioned flag value keys.
            // The worker itself no-ops unless ControlPlane:ConsistencyMode is GatedCommit.
            services.AddHostedService<AppServices.StagedFlagGcWorker>();
        }

        // track usage
        services.AddOptions<UsageTrackingOptions>()
            .Bind(configuration.GetSection(UsageTrackingOptions.UsageTracking))
            .ValidateDataAnnotations()
            .ValidateOnStart();
        services.AddSingleton<UsageTracker>();
        services.AddHostedService<AppServices.UsageFlushWorker>();

        // track insights
        services.AddOptions<InsightsTrackingOptions>()
            .Bind(configuration.GetSection(InsightsTrackingOptions.InsightsTracking))
            .ValidateDataAnnotations()
            .Validate(
                options => options.MaxBatchSize <= options.ChannelCapacity,
                "Max batch size must not exceed channel capacity."
            )
            .ValidateOnStart();
        services.AddSingleton<InsightsTracker>();
        services.AddHostedService<AppServices.InsightsFlushWorker>();

        // messaging services
        services.AddMq(configuration);

        // identity
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<IIdentityService, Services.IdentityService>();

        // http clients
        services.AddHttpClient<IAgentService, Services.AgentService>();
        var webhookAllowedAddresses = Services.WebhookHandlerFactory.GetAllowedAddresses(configuration);
        var webhookAllowedHosts = Services.WebhookHandlerFactory.GetAllowedHosts(configuration);
        services
            .AddHttpClient<IWebhookSender, Services.WebhookSender>()
            .ConfigurePrimaryHttpMessageHandler(() =>
                Services.WebhookHandlerFactory.CreateHandler(webhookAllowedAddresses, webhookAllowedHosts)
            );

        // custom services
        services.AddDbSpecificServices(configuration);
        services.AddProviderCredentials(configuration);
        services.AddTransient<IEnvironmentAppService, AppServices.EnvironmentAppService>();
        services.AddTransient<IFeatureFlagAppService, AppServices.FeatureFlagAppService>();
        if (configuration.IsSaasHosting())
        {
            services.AddTransient<IBillingService, Services.BillingService>();
        }
        else
        {
            services.AddTransient<IBillingService, Services.NoopBillingService>();
        }

        return services;
    }

    internal static IServiceCollection AddProviderCredentials(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(Services.ProviderCredentialOptions.Section);
        services.AddOptionsWithValidateOnStart<Services.ProviderCredentialOptions>()
            .Bind(section)
            .Validate(options => !section.Exists() || options.HasValidKeyRing(),
                "ReleaseHealth:Credentials requires an active key ID and a key ring of base64-encoded 32-byte keys.");
        return services.AddSingleton<IProviderCredentialProtector, Services.ProviderCredentialProtector>();
    }
}
