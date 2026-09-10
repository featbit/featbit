using Api.Authentication;
using Api.Authentication.OAuth;
using Api.Authentication.OpenIdConnect;
using Api.Authorization;
using Api.Mcp;
using Api.Swagger;
using Application.Services;
using Domain.Observability;
using Domain.Workspaces;
using Domain.Policies;
using FeatBit.Observability.AspNetCore;
using Infrastructure;
using Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Swashbuckle.AspNetCore.Filters;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Api.Setup;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        // Observability: apply configured settings before anything can create a span or hash a
        // credential, then register the propagation-only activity listener before anything can log,
        // so that every record carries a trace id even with no exporter configured, and name the
        // ingress activity source after this service (docs/observability/index.md §11).
        ObservabilityConfiguration.Apply(builder.Configuration);
        ActivityCorrelation.EnsureListener();
        FeatBitActivitySources.ConfigureIngress(FeatBitActivitySources.Api);

        // The API is the default, but configure it explicitly so the three hosts read identically
        // and a copy/paste into another host cannot silently inherit the wrong prefix.
        ServiceMeter.Configure(FeatBitMeters.Api, FeatBitInstruments.ApiPrefix);
        MessagingMetrics.Configure(FeatBitMeters.Api, FeatBitInstruments.ApiPrefix);
        PropagationMetrics.Configure(FeatBitMeters.Api, FeatBitInstruments.ApiPrefix);
        InsightsMetrics.Configure(FeatBitMeters.Api, FeatBitInstruments.ApiPrefix);
        RequestMetrics.Configure(FeatBitMeters.Api, FeatBitInstruments.ApiPrefix);

        // serilog
        builder.Services.AddSerilog((_, lc) => ConfigureSerilog.Configure(lc, builder.Configuration));

        // add services for controllers
        builder.Services.AddControllers();

        // add mcp server & tools
        builder.Services
            .AddMcpServer()
            .WithHttpTransport(options => options.Stateless = true)
            .WithToolsFromAssembly();

        // make all generated paths URLs are lowercase
        builder.Services.Configure<RouteOptions>(options => options.LowercaseUrls = true);

        // api versioning
        builder.Services
            .AddApiVersioning(options => options.ReportApiVersions = true)
            .AddMvc()
            .AddApiExplorer(options =>
            {
                // add the versioned api explorer, which also adds IApiVersionDescriptionProvider service
                // note: the specified format code will format the version as "'v'major[.minor][-status]"
                options.GroupNameFormat = "'v'VVV";

                // note: this option is only necessary when versioning by url segment. the SubstitutionFormat
                // can also be used to control the format of the API version in route templates
                options.SubstituteApiVersionInUrl = true;
            });

        // cors
        builder.Services.AddCors(options => options.AddDefaultPolicy(policyBuilder =>
        {
            policyBuilder
                .SetIsOriginAllowed(_ => true)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }));

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        builder.Services.AddTransient<IConfigureOptions<SwaggerGenOptions>, ConfigureSwaggerOptions>();
        builder.Services.AddSwaggerGen(options => options.CustomSchemaIds(type => SwashbuckleSchemaHelper.GetSchemaId(type)));
        builder.Services.AddSwaggerExamplesFromAssemblyOf<Program>();

        // health check dependencies
        builder.Services.AddHealthChecks()
            .AddReadinessChecks(builder.Configuration)
            .AddDiagnosticChecks(builder.Configuration);

        // add infrastructure & application services
        builder.Services.AddInfrastructureServices(builder.Configuration);
        builder.Services.AddApplicationServices(builder.Configuration);

        // authentication
        var jwtOptions = JwtOptionsBuilder.Build(builder.Configuration);
        builder.Services.AddSingleton(jwtOptions);
        builder.Services.AddScoped<DefaultJwtBearerEvents>();
        builder.Services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = Schemes.SchemeSelector;
                options.DefaultChallengeScheme = Schemes.SchemeSelector;
            })
            .AddPolicyScheme(Schemes.SchemeSelector, Schemes.SchemeSelector, options =>
            {
                options.ForwardDefaultSelector = context =>
                {
                    string? authorization = context.Request.Headers.Authorization;
                    if (!string.IsNullOrEmpty(authorization) && authorization.StartsWith("Bearer "))
                    {
                        return Schemes.JwtBearer;
                    }

                    return Schemes.OpenApi;
                };
            })
            .AddJwtBearer(Schemes.JwtBearer, options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    AuthenticationType = Schemes.JwtBearer,

                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,

                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,

                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = jwtOptions.VerificationSecurityKey,

                    ValidAlgorithms = [jwtOptions.Algorithm],

                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero
                };
                options.EventsType = typeof(DefaultJwtBearerEvents);
            })
            .AddOpenApi(Schemes.OpenApi);

        // authorization
        LicenseVerifier.ImportPublicKey(builder.Configuration["PublicKey"]);
        builder.Services.AddTransient<ILicenseService, LicenseService>();
        builder.Services.AddScoped<IRequestPermissions, RequestPermissions>();
        builder.Services.AddScoped<IPermissionChecker, DefaultPermissionChecker>();
        builder.Services.AddScoped<IAuthorizationHandler, PermissionRequirementHandler>();
        builder.Services.AddScoped<IAuthorizationHandler, LicenseRequirementHandler>();
        builder.Services.AddAuthorization(options =>
        {
            // iam permission check 
            foreach (var permission in Permissions.All)
            {
                options.AddPolicy(
                    permission,
                    policyBuilder => policyBuilder.AddRequirements(new PermissionRequirement(permission))
                );
            }

            // license check
            foreach (var feature in LicenseFeatures.All)
            {
                options.AddPolicy(
                    feature,
                    policyBuilder => policyBuilder.AddRequirements(new LicenseRequirement(feature))
                );
            }
        });

        // add OIDC & OAuth client
        builder.Services.AddHttpClient<OidcClient>();
        builder.Services.AddHttpClient<OAuthClient>();

        // replace default authorization result handler
        var authorizationResultHandler =
            ServiceDescriptor.Singleton<IAuthorizationMiddlewareResultHandler>(new ApiAuthorizationResultHandler());
        builder.Services.Replace(authorizationResultHandler);

        return builder;
    }
}
