using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text;
using System.Text.Json;
using Api.Middlewares;
using Api.Setup;
using Application.Segments;
using FluentValidation.Results;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Api.UnitTests.Setup;

public class ModelValidationResponseTests : IDisposable
{
    private readonly IHost _host;
    private readonly HttpClient _client;

    public ModelValidationResponseTests()
    {
        _host = new HostBuilder().ConfigureWebHost(web => web.UseTestServer()
            .ConfigureServices(services => services.AddControllers()
                .AddApplicationPart(typeof(ValidationProbeController).Assembly)
                .ConfigureApiBehaviorOptions(options =>
                    options.InvalidModelStateResponseFactory = ModelValidationResponse.Create))
            .Configure(app =>
            {
                app.UseApiExceptionHandler();
                app.UseRouting();
                app.UseEndpoints(endpoints => endpoints.MapControllers());
            })).Start();
        _client = _host.GetTestClient();
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"scopes\":null}")]
    [InlineData("{\"scopes\":[]}")]
    public async Task InvalidScopes_ReturnsExistingErrorCode(string json)
    {
        await AssertErrors("segment", json, "scopes_is_invalid");
    }

    [Theory]
    [InlineData("{")]
    [InlineData("{\"scopes\":123}")]
    [InlineData("")]
    public async Task InvalidBody_ReturnsGenericCodeWithoutBindingDetails(string json)
    {
        await AssertErrors("segment", json, "request_is_invalid");
    }

    [Fact]
    public async Task InvalidRouteValue_ReturnsGenericCode()
    {
        await AssertErrors("id/not-a-guid", "{}", "request_is_invalid");
    }

    [Fact]
    public async Task DefaultAnnotationMessage_ReturnsGenericCode()
    {
        await AssertErrors("default", "{}", "request_is_invalid");
    }

    [Fact]
    public async Task MultipleErrors_PreservesDistinctCodes()
    {
        await AssertErrors("multiple", "{}", "name_is_required", "scopes_is_invalid");
    }

    [Fact]
    public async Task FluentValidation_RetainsExistingEnvelope()
    {
        await AssertErrors("fluent", "{}", "scopes_is_invalid");
    }

    [Fact]
    public async Task ValidBody_ReachesAction()
    {
        var response = await _client.PostAsync("/validation-probe/segment",
            new StringContent("{\"scopes\":[\"organization/test\"]}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private async Task AssertErrors(string path, string json, params string[] expected)
    {
        var response = await _client.PostAsync($"/validation-probe/{path}",
            new StringContent(json, Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var body = document.RootElement;
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("data").ValueKind);
        Assert.Equal(expected.Order(), body.GetProperty("errors").EnumerateArray()
            .Select(error => error.GetString()).Order());
        Assert.Equal(3, body.EnumerateObject().Count());
    }

    public void Dispose()
    {
        _client.Dispose();
        _host.Dispose();
    }
}

[ApiController]
[Route("validation-probe")]
public class ValidationProbeController : ControllerBase
{
    [HttpPost("segment")]
    public IActionResult Segment(CreateSegment request) => NoContent();

    [HttpPost("id/{id}")]
    public IActionResult Id(Guid id) => NoContent();

    [HttpPost("default")]
    public IActionResult Default(DefaultValidationPayload request) => NoContent();

    [HttpPost("multiple")]
    public IActionResult Multiple(MultipleValidationPayload request) => NoContent();

    [HttpPost("fluent")]
    public IActionResult Fluent() => throw new FluentValidation.ValidationException(
        [new ValidationFailure("Scopes", "Invalid scopes") { ErrorCode = "scopes_is_invalid" }]);
}

public class DefaultValidationPayload
{
    [Required]
    public string? Name { get; set; }
}

public class MultipleValidationPayload
{
    [Required(ErrorMessage = "name_is_required")]
    public string? Name { get; set; }

    [Required(ErrorMessage = "scopes_is_invalid")]
    public string[]? Scopes { get; set; }

    [Required(ErrorMessage = "scopes_is_invalid")]
    public string[]? OtherScopes { get; set; }
}
