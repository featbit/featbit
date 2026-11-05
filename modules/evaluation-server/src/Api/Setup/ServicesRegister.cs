using Api.Authentication;
using Api.ControlPlane;
using Api.Cors;
using Api.RateLimiting;
using Api.Services;
using Domain.Shared.Authentication;
using Domain.Workspaces;
using Infrastructure;
using Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
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

        services.AddOpenApi("v1", options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info = new OpenApiInfo
                {
                    Title = "FeatBit Evaluation Server",
                    Version = "v1",
                    Description = "Serves feature flag and segment data to FeatBit SDKs. Provides HTTP endpoints " +
                                  "for fetching flag data, evaluating flags and reporting events."
                };
                return Task.CompletedTask;
            });
        });

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
            .SetFallbackPolicy(requireAuthPolicy)
            .AddPolicy(FeatBitPolicies.ServerSecretOnly, policy => policy
                .RequireAuthenticatedUser().RequireClaim(FeatBitClaims.SecretType, SecretTypes.Server))
            .AddPolicy(FeatBitPolicies.ClientSecretOnly, policy => policy
                .RequireAuthenticatedUser().RequireClaim(FeatBitClaims.SecretType, SecretTypes.Client))
            .AddPolicy(FeatBitPolicies.ServerSecretOrClientSecret, policy => policy
                .RequireAuthenticatedUser().RequireClaim(FeatBitClaims.SecretType, SecretTypes.Client, SecretTypes.Server));

        // Structural parsing is shared; HTTP and Streaming also verify the complete secret against the store.
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

        // add control-plane services if the control-plane topology is enabled
        if (configuration.UseControlPlane())
        {
            services.AddControlPlane(configuration);
        }

        return builder;
    }
}
