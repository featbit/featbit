using System.Net;
using System.Text.Json;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class SegmentOpenApiSchemaTests
{
    private readonly TestApp _app;

    public SegmentOpenApiSchemaTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task GetOpenApiDocument_CreateSegmentSchema_ScopesIsRequiredNonNullableAndNonEmpty()
    {
        var response = await _app.GetAsync("/swagger/OpenApi/swagger.json", authenticated: false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        var schema = document.RootElement
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty("CreateSegment");

        var required = schema.GetProperty("required").EnumerateArray().Select(x => x.GetString());
        Assert.Contains("scopes", required);

        var scopes = schema.GetProperty("properties").GetProperty("scopes");
        Assert.Equal("array", scopes.GetProperty("type").GetString());
        Assert.Equal(1, scopes.GetProperty("minItems").GetInt32());
        Assert.False(
            scopes.TryGetProperty("nullable", out var nullable) && nullable.GetBoolean(),
            "Expected CreateSegment.scopes not to be nullable."
        );
    }
}