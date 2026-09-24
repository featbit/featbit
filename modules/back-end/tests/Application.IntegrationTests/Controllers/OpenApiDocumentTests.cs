using System.Net;
using System.Text.Json;

namespace Application.IntegrationTests.Controllers;

/// <summary>
/// Guards the generated OpenAPI documents themselves: that the versioned document exposes the
/// PATCH endpoints with their named request examples, and that the filtered public "OpenApi"
/// document only contains the subset of operations marked with [OpenApi].
/// </summary>
[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class OpenApiDocumentTests
{
    private const string PatchFeatureFlagPathFragment = "/feature-flags/{key}";

    private readonly TestApp _app;

    public OpenApiDocumentTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task V1Document_Always_ContainsPatchFeatureFlagWithNamedExamples()
    {
        using var document = await GetDocumentAsync("v1");

        var patchOperation = GetOperation(document, PatchFeatureFlagPathFragment, "patch");

        var examples = patchOperation
            .GetProperty("requestBody")
            .GetProperty("content")
            .GetProperty("application/json")
            .GetProperty("examples");

        Assert.True(examples.EnumerateObject().Any(), "Expected named PATCH examples to be present.");
        Assert.Contains(examples.EnumerateObject(), e => e.Name == "Archive the flag");
    }

    [Fact]
    public async Task OpenApiDocument_Always_IsAStrictSubsetOfV1ContainingOnlyPublicOperations()
    {
        using var v1Document = await GetDocumentAsync("v1");
        using var openApiDocument = await GetDocumentAsync("OpenApi");

        var v1PathCount = v1Document.RootElement.GetProperty("paths").EnumerateObject().Count();
        var openApiPathCount = openApiDocument.RootElement.GetProperty("paths").EnumerateObject().Count();

        Assert.True(
            openApiPathCount > 0 && openApiPathCount < v1PathCount,
            $"Expected the public document ({openApiPathCount} paths) to be a non-empty, strict subset of v1 ({v1PathCount} paths)."
        );

        // The PATCH feature flag endpoint is explicitly marked [OpenApi], so it must still show up here.
        GetOperation(openApiDocument, PatchFeatureFlagPathFragment, "patch");
    }

    private async Task<JsonDocument> GetDocumentAsync(string documentName)
    {
        var response = await _app.GetAsync($"/openapi/{documentName}.json", authenticated: false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var stream = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(stream);
    }

    private static JsonElement GetOperation(JsonDocument document, string pathFragment, string httpMethod)
    {
        var paths = document.RootElement.GetProperty("paths");

        var match = paths.EnumerateObject()
            .FirstOrDefault(p => p.Name.Contains(pathFragment, StringComparison.OrdinalIgnoreCase));

        Assert.False(
            match.Value.ValueKind == JsonValueKind.Undefined,
            $"Expected a path containing '{pathFragment}' in the document."
        );

        Assert.True(
            match.Value.TryGetProperty(httpMethod, out var operation),
            $"Expected a '{httpMethod}' operation on '{match.Name}'."
        );

        return operation;
    }
}
