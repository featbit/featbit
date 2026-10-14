using Application.Segments;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Api.Swagger;

/// <summary>
/// Documents <see cref="CreateSegment.Scopes"/> as required, non-nullable and non-empty, matching
/// <see cref="CreateSegmentValidator"/>. This is done in the OpenAPI schema only, rather than with data
/// annotations, so request validation and its error responses stay unchanged.
/// </summary>
public class CreateSegmentSchemaFilter : ISchemaFilter
{
    private const string ScopesPropertyName = "scopes";

    public void Apply(IOpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type != typeof(CreateSegment) || schema is not OpenApiSchema concrete)
        {
            return;
        }

        if (concrete.Properties is null ||
            !concrete.Properties.TryGetValue(ScopesPropertyName, out var scopes) ||
            scopes is not OpenApiSchema scopesSchema)
        {
            return;
        }

        concrete.Required ??= new HashSet<string>();
        concrete.Required.Add(ScopesPropertyName);

        scopesSchema.MinItems = 1;
        if (scopesSchema.Type.HasValue)
        {
            scopesSchema.Type &= ~JsonSchemaType.Null;
        }
    }
}
