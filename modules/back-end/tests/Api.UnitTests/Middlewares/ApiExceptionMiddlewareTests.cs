using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Controllers;
using Api.Middlewares;
using Application.Bases;
using Application.Bases.Exceptions;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Api.UnitTests.Middlewares;

/// <summary>
/// Verifies <see cref="ApiExceptionMiddlewareExtension.UseApiExceptionHandler"/> translates each
/// known exception type into the documented HTTP status + <see cref="ApiResponse{T}"/> shape.
/// Uses a minimal in-process TestServer so the test stays focused on the middleware
/// (no controllers, no auth, no DI graph).
/// </summary>
public class ApiExceptionMiddlewareTests
{
    private static async Task<TestServer> CreateServerAsync(Exception toThrow)
    {
        var host = await new HostBuilder()
            .ConfigureWebHost(web =>
            {
                web.UseTestServer();
                web.ConfigureServices(_ => { });
                web.Configure(app =>
                {
                    app.UseApiExceptionHandler();
                    app.Run(_ => throw toThrow);
                });
            })
            .StartAsync();

        return host.GetTestServer();
    }

    private static async Task<ApiResponse<object>?> ReadBodyAsync(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<ApiResponse<object>>(
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }

    [Fact]
    public async Task ValidationException_Returns400WithErrorCodes()
    {
        var ex = new ValidationException(new[]
        {
            new ValidationFailure("Name", "required") { ErrorCode = "NameRequired" },
            new ValidationFailure("Key", "invalid")  { ErrorCode = "KeyInvalid" }
        });
        using var server = await CreateServerAsync(ex);

        var response = await server.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await ReadBodyAsync(response);
        Assert.NotNull(body);
        Assert.False(body!.Success);
        Assert.Contains("NameRequired", body.Errors);
        Assert.Contains("KeyInvalid", body.Errors);
    }

    [Fact]
    public async Task EntityNotFoundException_Returns404WithResourceNotFound()
    {
        using var server = await CreateServerAsync(new EntityNotFoundException("Thing", Guid.NewGuid().ToString()));

        var response = await server.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await ReadBodyAsync(response);
        Assert.False(body!.Success);
        Assert.Contains(ErrorCodes.ResourceNotFound, body.Errors);
    }

    [Fact]
    public async Task ConflictException_Returns409()
    {
        using var server = await CreateServerAsync(new ConflictException("Thing", Guid.NewGuid()));

        var response = await server.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await ReadBodyAsync(response);
        Assert.False(body!.Success);
        Assert.Contains(ErrorCodes.Conflict, body.Errors);
    }

    [Fact]
    public async Task ForbiddenException_Returns403()
    {
        using var server = await CreateServerAsync(new ForbiddenException());

        var response = await server.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await ReadBodyAsync(response);
        Assert.False(body!.Success);
        Assert.Contains(ErrorCodes.Forbidden, body.Errors);
    }

    [Fact]
    public async Task BusinessException_Returns422WithBusinessErrorCode()
    {
        using var server = await CreateServerAsync(new BusinessException("WidgetMaximumExceeded"));

        var response = await server.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var body = await ReadBodyAsync(response);
        Assert.False(body!.Success);
        Assert.Contains("WidgetMaximumExceeded", body.Errors);
    }

    [Fact]
    public async Task UnknownException_Returns500WithInternalServerError()
    {
        using var server = await CreateServerAsync(new InvalidOperationException("boom"));

        var response = await server.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var body = await ReadBodyAsync(response);
        Assert.False(body!.Success);
        Assert.Contains(ErrorCodes.InternalServerError, body.Errors);
    }
}
