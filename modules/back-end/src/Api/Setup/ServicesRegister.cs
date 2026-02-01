using System.Text;
using Api.Authentication;
using Api.Authentication.OAuth;
using Api.Authentication.OpenIdConnect;
using Api.Authorization;
using Api.Swagger;
using Application.Services;
using Domain.Workspaces;
using Domain.Identity;
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
        // serilog
        builder.Services.AddSerilog((_, lc) => ConfigureSerilog.Configure(lc, builder.Configuration));

        // add services for controllers
        builder.Services.AddTransient<IConfigureOptions<MvcOptions>, ConfigureMvcOptions>();
        builder.Services.AddControllers();

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
                .AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }));

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        builder.Services.AddTransient<IConfigureOptions<SwaggerGenOptions>, ConfigureSwaggerOptions>();
        builder.Services.AddSwaggerGen(options => options.CustomSchemaIds(type => SwashbuckleSchemaHelper.GetSchemaId(type)));
        builder.Services.AddSwaggerExamplesFromAssemblyOf<Program>();

        // health check dependencies
        builder.Services.AddHealthChecks().AddReadinessChecks(builder.Configuration);

        // add infrastructure & application services
        builder.Services.AddInfrastructureServices(builder.Configuration);
        builder.Services.AddApplicationServices();

        // authentication
        var jwtOption = builder.Configuration.GetSection(JwtOptions.Jwt);
        builder.Services.Configure<JwtOptions>(jwtOption);
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
                    ValidIssuer = jwtOption["Issuer"],

                    ValidateAudience = true,
                    ValidAudience = jwtOption["Audience"],

                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOption["Key"]!))
                };
            })
            .AddOpenApi(Schemes.OpenApi);

        // authorization
        LicenseVerifier.ImportPublicKey(builder.Configuration["PublicKey"]);
        builder.Services.AddTransient<ILicenseService, LicenseService>();
        builder.Services.AddSingleton<IPermissionChecker, DefaultPermissionChecker>();
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