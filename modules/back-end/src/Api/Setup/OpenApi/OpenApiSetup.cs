using System.Reflection;
using Asp.Versioning.ApiExplorer;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using OpenApiConstants = Api.Authentication.OpenApiConstants;
using OpenApiAttribute = Api.Authentication.OpenApiAttribute;

namespace Api.Setup.OpenApi;

// mirrors Swashbuckle's former ConfigureSwaggerOptions: one OpenApi document per discovered API
// version, plus a filtered "OpenApi" document that only exposes actions/controllers carrying the
// [OpenApi] attribute (see Api.Authentication.OpenApiAttribute).
public static class OpenApiSetup
{
    public static IServiceCollection AddBackendOpenApi(this IServiceCollection services)
    {
        // Api versioning + ApiExplorer must already be registered on `services` at this point so
        // the version descriptions used below are discoverable.
        using var provider = services.BuildServiceProvider();
        var versionProvider = provider.GetRequiredService<IApiVersionDescriptionProvider>();

        foreach (var description in versionProvider.ApiVersionDescriptions)
        {
            var groupName = description.GroupName;
            var info = CreateOpenApiInfo(
                "FeatBit Backend Api",
                description.ApiVersion.ToString(),
                description.IsDeprecated
            );

            services.AddOpenApi(groupName, options =>
            {
                options.ShouldInclude = apiDesc => apiDesc.GroupName == groupName;
                ConfigureCommon(options, info);
            });
        }

        services.AddOpenApi(OpenApiConstants.ApiGroupName, options =>
        {
            options.ShouldInclude = IsPublicOpenApiAction;
            ConfigureCommon(options, CreateOpenApiInfo("FeatBit Open Api", "1.0"));
        });

        return services;
    }

    private static bool IsPublicOpenApiAction(ApiDescription apiDesc)
    {
        if (apiDesc.ActionDescriptor is not ControllerActionDescriptor descriptor)
        {
            return false;
        }

        return descriptor.MethodInfo.GetCustomAttribute<OpenApiAttribute>(true) != null ||
               descriptor.ControllerTypeInfo.GetCustomAttribute<OpenApiAttribute>(true) != null;
    }

    private static void ConfigureCommon(OpenApiOptions options, OpenApiInfo info)
    {
        options.AddDocumentTransformer((document, _, _) =>
        {
            document.Info = info;
            return Task.CompletedTask;
        });
        options.AddDocumentTransformer<SecuritySchemeTransformer>();
        options.AddOperationTransformer<HeaderParametersTransformer>();
        options.AddOperationTransformer<RequestExamplesOperationTransformer>();
        options.CreateSchemaReferenceId = SchemaIdHelper.GetSchemaId;
    }

    private static OpenApiInfo CreateOpenApiInfo(string title, string version, bool isDeprecated = false)
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
