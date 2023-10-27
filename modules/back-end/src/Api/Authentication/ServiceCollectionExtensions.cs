using Api.Authentication.OpenIdConnect;

namespace Api.Authentication;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSso(this IServiceCollection services, ConfigurationManager configuration)
    {
        services.Configure<OidcOptions>(configuration.GetSection(OidcOptions.Oidc));
        services.AddSingleton<OidcClient>();

        return services;
    }
}