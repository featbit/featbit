using Application.ReleaseHealth;
using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.ReleaseHealth;

public static class Registration
{
    public static IServiceCollection AddReleaseHealth(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<ICredentialProtector, AesCredentialProtector>();
        services.AddSingleton<IMetricSourceProvider, PrometheusProvider>();
        services.AddScoped<ReleaseHealthService>();
        if (configuration.GetDbProvider().Name == DbProvider.Postgres) services.AddScoped<IReleaseHealthStore, PostgresReleaseHealthStore>();
        else services.AddScoped<IReleaseHealthStore, MongoReleaseHealthStore>();
        return services;
    }
}
