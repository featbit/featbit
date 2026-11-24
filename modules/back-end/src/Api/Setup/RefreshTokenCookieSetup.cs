using Api.Authentication;

namespace Api.Setup;

public static class RefreshTokenCookieSetup
{
    public static IServiceCollection AddRefreshTokenCookies(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<RefreshTokenCookieOptions>()
            .Bind(configuration.GetSection("Authentication"))
            .Validate(options => IsValidPath(options.RefreshTokenCookiePath),
                "Authentication__RefreshTokenCookiePath must be empty or a path starting with '/'.")
            .ValidateOnStart();

        return services;
    }

    private static bool IsValidPath(string? path) =>
        string.IsNullOrEmpty(path) || path.StartsWith('/');
}
