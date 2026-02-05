using Api.Authentication;
using Asp.Versioning.ApiExplorer;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.Filters;
using Swashbuckle.AspNetCore.SwaggerGen;
using OpenApiConstants = Api.Authentication.OpenApiConstants;

namespace Api.Swagger;

// taken from https://github.com/dotnet/aspnet-api-versioning/blob/main/examples/AspNetCore/WebApi/OpenApiExample/ConfigureSwaggerOptions.cs

/// <summary>
/// Configures the Swagger generation options.
/// </summary>
/// <remarks>This allows API versioning to define a Swagger document per API version after the
/// <see cref="IApiVersionDescriptionProvider"/> service has been resolved from the service container.</remarks>
public class ConfigureSwaggerOptions : IConfigureOptions<SwaggerGenOptions>
{
    private readonly IApiVersionDescriptionProvider _provider;

    /// <summary>
    /// Initializes a new instance of the <see cref="ConfigureSwaggerOptions"/> class.
    /// </summary>
    /// <param name="provider">The <see cref="IApiVersionDescriptionProvider">provider</see> used to generate Swagger documents.</param>
    public ConfigureSwaggerOptions(IApiVersionDescriptionProvider provider) => _provider = provider;

    /// <inheritdoc />
    public void Configure(SwaggerGenOptions options)
    {
        AddDocs(options, _provider);
        DefineDocInclusionPredicate(options);
        AddXmlComments(options);
        AddSecurity(options);
        AddFilters(options);
    }

    private static void AddDocs(SwaggerGenOptions options, IApiVersionDescriptionProvider provider)
    {
        // backend api doc
        // add a swagger document for each discovered API version
        // note: you might choose to skip or document deprecated API versions differently
        foreach (var description in provider.ApiVersionDescriptions)
        {
            var backendApiInfo = CreateOpenApiInfo(
                "FeatBit Backend Api",
                description.ApiVersion.ToString(),
                description.IsDeprecated
            );

            options.SwaggerDoc(description.GroupName, backendApiInfo);
        }

        // open api doc
        options.SwaggerDoc(OpenApiConstants.ApiGroupName, CreateOpenApiInfo("FeatBit Open Api", "1.0"));
        options.OperationFilter<OrganizationHeaderParameter>();
        options.OperationFilter<WorkspaceHeaderParameter>();

        return;

        OpenApiInfo CreateOpenApiInfo(string title, string version, bool isDeprecated = false)
        {
            var info = new OpenApiInfo
            {
                Title = title,
                Version = version,
                Contact = new OpenApiContact
                {
                    Name = "FeatBit",
                    Url = new Uri("https://github.com/featbit/featbit")
                },
                License = new OpenApiLicense { Name = "MIT", Url = new Uri("https://opensource.org/licenses/MIT") }
            };

            if (isDeprecated)
            {
                info.Description += "<span style=\"color:red\"> This API version has been deprecated.</span>";
            }

            return info;
        }
    }

    private static void DefineDocInclusionPredicate(SwaggerGenOptions options)
    {
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
    }

    private static void AddXmlComments(SwaggerGenOptions options)
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
    }

    private static void AddSecurity(SwaggerGenOptions options)
    {
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
    }

    private static void AddFilters(SwaggerGenOptions options)
    {
        options.ExampleFilters();
    }
}