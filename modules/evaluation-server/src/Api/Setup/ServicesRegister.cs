using Api.Authentication;
using Api.Cors;
using Api.RateLimiting;
using Api.Services;
using Domain.Shared.Authentication;
using Domain.Workspaces;
using Infrastructure;
using Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Serilog;
using Streaming;
using Streaming.DependencyInjection;

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
        services.AddHealthChecks().AddReadinessChecks(configuration);

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

        return builder;
    }
}