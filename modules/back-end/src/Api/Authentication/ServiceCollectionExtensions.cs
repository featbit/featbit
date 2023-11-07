using Api.Authentication.OpenIdConnect;

namespace Api.Authentication;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSso(this IServiceCollection services, ConfigurationManager configuration)
    {
        services.AddSingleton<OidcClient>();
        return services;
    }
}