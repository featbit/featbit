using System.Text;
using Api.Authentication;
using Api.Authorization;
using Domain.Identity;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Net.Http.Headers;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using OpenApiConstants = Api.Authentication.OpenApiConstants;

namespace Api.Setup;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        // add services for controllers
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
        builder.Services.AddSwaggerGen(options =>
        {
            var xmlComments = new[] { "Api.xml", "Application.xml", "Domain.xml", "Infrastructure.xml" };
            foreach (var xmlComment in xmlComments)
            {
                // integrate xml comments
                options.IncludeXmlComments(
                    Path.Combine(AppContext.BaseDirectory, xmlComment),
                    includeControllerXmlComments: true
                );
            }

            options.DocInclusionPredicate((docName, apiDesc) =>
            {
                if (docName != OpenApiConstants.ApiGroupName)
                {
                    // same logic with SwaggerGeneratorOptions.DefaultDocInclusionPredicate
                    return apiDesc.GroupName == null || apiDesc.GroupName == docName;
                }

                if (!apiDesc.TryGetMethodInfo(out var methodInfo))
                {
                    return false;
                }

                // method with OpenApiAttribute
                return methodInfo.GetCustomAttributes(typeof(OpenApiAttribute), false).Length > 0;
            });

            options.AddSecurityDefinition("JwtBearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                Description =
                    "Standard Authorization header using the Bearer scheme (JWT). Example: \"Authorization: Bearer eyJ...\""
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "JwtBearer" }
                    },
                    Array.Empty<string>()
                }
            });

            options.AddSecurityDefinition("AccessToken", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.ApiKey,
                Name = "Authorization",
                In = ParameterLocation.Header,
                Scheme = "AccessToken",
                Description = "Use access token to access this API. Example: \"Authorization: api-MzQ...\""
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "AccessToken" }
                    },
                    Array.Empty<string>()
                }
            });
        });

        // health check dependencies
        builder.Services.AddHealthChecks();

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
                    string authorization = context.Request.Headers[HeaderNames.Authorization];
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
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOption["Key"]))
                };
            })
            .AddOpenApi(Schemes.OpenApi);

        // authorization
        builder.Services.AddSingleton<IPermissionChecker, DefaultPermissionChecker>();
        builder.Services.AddSingleton<IAuthorizationHandler, PermissionRequirementHandler>();
        builder.Services.AddAuthorization(options =>
        {
            foreach (var permission in Permissions.All)
            {
                options.AddPolicy(
                    permission,
                    policyBuilder => policyBuilder.AddRequirements(new PermissionRequirement(permission))
                );
            }
        });

        // replace default authorization result handler
        var authorizationResultHandler =
            ServiceDescriptor.Singleton<IAuthorizationMiddlewareResultHandler>(new ApiAuthorizationResultHandler());
        builder.Services.Replace(authorizationResultHandler);

        // set json patch
        builder.Services.AddControllers(options =>
            {
                options.InputFormatters.Insert(0, JsonPatchInputFormatter.GetJsonPatchInputFormatter());
            })
            .AddNewtonsoftJson();
        
        return builder;
    }
}