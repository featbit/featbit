using Api.Authentication.OAuth;
using Api.Authentication.OpenIdConnect;

namespace Api.Authentication;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddSso(this IServiceCollection services)
    {
        services.AddSingleton<OidcClient>();
        return services;
    }
    
    public static IServiceCollection AddOAuth(this IServiceCollection services)
    {
        services.AddSingleton<SocialClient>();
        return services;
    }
}