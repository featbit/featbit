using Asp.Versioning.ApiExplorer;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using OpenApiConstants = Api.Authentication.OpenApiConstants;

namespace Api.Setup;

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
        // add a swagger document for each discovered API version
        // note: you might choose to skip or document deprecated API versions differently
        foreach (var description in _provider.ApiVersionDescriptions)
        {
            var backendApiInfo = CreateOpenApiInfo(
                "FeatBit Backend Api",
                description.ApiVersion.ToString(),
                description.IsDeprecated
            );

            options.SwaggerDoc(description.GroupName, backendApiInfo);
        }

        // open api swagger doc
        options.SwaggerDoc(OpenApiConstants.ApiGroupName, CreateOpenApiInfo("FeatBit Open Api", "1.0"));

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
}