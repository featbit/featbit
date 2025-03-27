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
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // caching
        services.AddCache(configuration);

        // flag schedule worker
        services.AddHostedService<AppServices.FlagScheduleWorker>();

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
        services.AddHttpClient<IWebhookSender, Services.WebhookSender>();

        // custom services
        services.AddDbSpecificServices(configuration);
        services.AddTransient<IEnvironmentAppService, AppServices.EnvironmentAppService>();
        services.AddTransient<IFeatureFlagAppService, AppServices.FeatureFlagAppService>();

        // InsightsWriter must be a singleton service
        services.AddSingleton(typeof(AppServices.InsightsWriter));

        return services;
    }
}