using Application;
using Application.Usages;
using Domain.Users;
using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Security.AntiSSRF;
using Services = Infrastructure.Services;
using AppServices = Infrastructure.AppService;

// ReSharper disable CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;
// ReSharper restore CheckNamespace

public static class ConfigureServices
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // caching
        services.AddCache(configuration);

        // flag schedule worker
        services.AddHostedService<AppServices.FlagScheduleWorker>();

        // track usage
        services.AddOptions<UsageTrackingOptions>()
            .Bind(configuration.GetSection(UsageTrackingOptions.UsageTracking))
            .ValidateDataAnnotations()
            .ValidateOnStart();
        services.AddSingleton<UsageTracker>();
        services.AddHostedService<AppServices.UsageFlushWorker>();

        // messaging services
        services.AddMq(configuration);

        // identity
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<IIdentityService, Services.IdentityService>();

        // http clients
        services.AddHttpClient<IOlapService, Services.OlapService>(httpClient =>
        {
            httpClient.BaseAddress = new Uri(configuration["OLAP:ServiceHost"]!);
        });
        services.AddHttpClient<IAgentService, Services.AgentService>();
        services.AddHttpClient<IWebhookSender, Services.WebhookSender>()
            .ConfigurePrimaryHttpMessageHandler(() =>
            {
                var policy = new AntiSSRFPolicy(PolicyConfigOptions.ExternalOnlyLatest)
                {
                    AllowPlainTextHttp = true,

                    // ExternalOnlyLatest adds X-Forwarded-For: true by default as a
                    // defense-in-depth against IMDS. For an outgoing webhook sender the
                    // dummy value can cause third-party receivers to reject the request,
                    // and IMDS is already blocked by the IP-range enforcement, so disable it.
                    AddXFFHeader = false
                };

                return policy.GetHandler();
            });

        // custom services
        services.AddDbSpecificServices(configuration);
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

        // InsightsWriter must be a singleton service
        services.AddSingleton(typeof(AppServices.InsightsWriter));

        return services;
    }
}