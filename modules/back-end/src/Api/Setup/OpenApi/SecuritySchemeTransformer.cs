using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Api.Setup.OpenApi;

public sealed class SecuritySchemeTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(
        OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes = new Dictionary<string, IOpenApiSecurityScheme>
        {
            ["JwtBearer"] = new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                Description =
                    "Standard Authorization header using the Bearer scheme (JWT). Example: \"Authorization: Bearer eyJ...\""
            },
            ["AccessToken"] = new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.ApiKey,
                Name = "Authorization",
                In = ParameterLocation.Header,
                Scheme = "AccessToken",
                Description = "Use access token to access this API. Example: \"Authorization: api-MzQ...\""
            }
        };

        document.Security ??= [];
        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("JwtBearer", document)] = []
        });
        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("AccessToken", document)] = []
        });

        return Task.CompletedTask;
    }
}
