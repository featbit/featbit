using Api.Swagger;
using Application.Segments;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Api.UnitTests.Swagger;

public class CreateSegmentSchemaFilterTests
{
    [Fact]
    public void Apply_CreateSegment_MarksScopesAsRequiredNonNullableAndNonEmpty()
    {
        var scopes = new OpenApiSchema { Type = JsonSchemaType.Array | JsonSchemaType.Null };
        var schema = ObjectSchemaWithScopes(scopes);

        new CreateSegmentSchemaFilter().Apply(schema, ContextFor(typeof(CreateSegment)));

        Assert.NotNull(schema.Required);
        Assert.Contains("scopes", schema.Required);
        Assert.Equal(1, scopes.MinItems);
        Assert.Equal(JsonSchemaType.Array, scopes.Type);
    }

    [Fact]
    public void Apply_OtherType_LeavesSchemaUnchanged()
    {
        var scopes = new OpenApiSchema { Type = JsonSchemaType.Array | JsonSchemaType.Null };
        var schema = ObjectSchemaWithScopes(scopes);

        new CreateSegmentSchemaFilter().Apply(schema, ContextFor(typeof(string)));

        Assert.True(schema.Required is null || !schema.Required.Contains("scopes"));
        Assert.Null(scopes.MinItems);
        Assert.Equal(JsonSchemaType.Array | JsonSchemaType.Null, scopes.Type);
    }

    private static OpenApiSchema ObjectSchemaWithScopes(OpenApiSchema scopes) => new()
    {
        Type = JsonSchemaType.Object,
        Properties = new Dictionary<string, IOpenApiSchema> { ["scopes"] = scopes }
    };

    private static SchemaFilterContext ContextFor(Type type) => new(type, null!, null!);
}
