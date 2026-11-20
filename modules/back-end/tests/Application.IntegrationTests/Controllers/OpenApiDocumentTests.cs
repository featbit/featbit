using System.Net;
using System.Text.Json;

namespace Application.IntegrationTests.Controllers;

/// <summary>
/// Guards that every OpenAPI document can be generated and served.
/// </summary>
[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class OpenApiDocumentTests
{
    private readonly TestApp _app;

    public OpenApiDocumentTests(TestApp app)
    {
        _app = app;
    }

    [Theory]
    [InlineData("v1")]
    [InlineData("v2")]
    [InlineData("OpenApi")]
    public async Task GetDocument_Always_ReturnsValidDocumentWithPaths(string documentName)
    {
        var response = await _app.GetAsync($"/openapi/{documentName}.json", authenticated: false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);

        var root = document.RootElement;
        Assert.True(root.TryGetProperty("openapi", out _), "Expected the 'openapi' version field.");
        Assert.True(root.TryGetProperty("info", out _), "Expected the 'info' field.");
        Assert.True(root.GetProperty("paths").EnumerateObject().Any(), "Expected at least one path.");
    }

    [Fact]
    public async Task GetApiReference_Anonymous_ReturnsScalarPage()
    {
        var response = await _app.GetAsync("/docs", authenticated: false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("FeatBit Open Api", await response.Content.ReadAsStringAsync());
    }
}
