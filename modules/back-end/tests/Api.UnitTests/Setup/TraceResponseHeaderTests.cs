using Api.Setup;
using Domain.Observability;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;

namespace Api.UnitTests.Setup;

/// <summary>
/// The trace-identifier response header is how a user reporting a problem hands an operator a
/// pointer straight to the server-side records for that request.
/// </summary>
/// <remarks>
/// These run against a real host rather than a <c>DefaultHttpContext</c>: the header is written from
/// an <c>OnStarting</c> callback, which the bare test context never invokes. Using a real host also
/// exercises the part that matters most — that ASP.NET Core's own request activity is observed by
/// <see cref="ActivityCorrelation"/>, which is the whole reason a trace identifier exists at all.
/// </remarks>
[Collection(ActivityCorrelationCollection.Name)]
public class TraceResponseHeaderTests
{    [Fact]
    public async Task Header_ForAHandledRequest_MatchesTheTraceIdSeenInsideIt()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            string? observed = null;

            using var host = await StartHostAsync(async ctx =>
            {
                observed = ActivityCorrelation.TraceId;
                await ctx.Response.WriteAsync("ok");
            });

            var response = await host.GetTestClient().GetAsync("/");

            Assert.NotNull(observed);
            Assert.Equal(32, observed!.Length);
            Assert.Equal(
                observed,
                Assert.Single(response.Headers.GetValues(TraceResponseHeaderExtensions.HeaderName)));
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public async Task Header_IsWritten_WhenTheRequestFails()
    {
        // Failed requests are the ones worth correlating, so the header must be set before anything
        // downstream can start writing a response.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var host = await StartHostAsync(ctx =>
            {
                ctx.Response.StatusCode = 500;
                return Task.CompletedTask;
            });

            var response = await host.GetTestClient().GetAsync("/");

            Assert.Equal(500, (int)response.StatusCode);
            Assert.True(response.Headers.Contains(TraceResponseHeaderExtensions.HeaderName));
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public async Task Header_IsOmitted_WhenNothingIsListeningForActivities()
    {
        // Demonstrates why EnsureListener exists: with no listener, no activity is created, there is
        // no identifier to report, and the middleware writes nothing rather than an empty header.
        ActivityCorrelation.RemoveListener();

        using var host = await StartHostAsync(ctx => ctx.Response.WriteAsync("ok"));

        var response = await host.GetTestClient().GetAsync("/");

        Assert.False(response.Headers.Contains(TraceResponseHeaderExtensions.HeaderName));
    }

    [Fact]
    public async Task Middleware_ForAHandledRequest_LeavesTheBodyAndStatusCodeUnchanged()
    {
        // Error response bodies are part of the API contract; this middleware may only add a header.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var host = await StartHostAsync(async ctx =>
            {
                ctx.Response.StatusCode = 418;
                await ctx.Response.WriteAsync("original body");
            });

            var response = await host.GetTestClient().GetAsync("/");

            Assert.Equal(418, (int)response.StatusCode);
            Assert.Equal("original body", await response.Content.ReadAsStringAsync());
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    private static async Task<IHost> StartHostAsync(RequestDelegate terminal)
        => await new HostBuilder()
            .ConfigureWebHost(webBuilder => webBuilder
                .UseTestServer()
                .Configure(app =>
                {
                    app.UseTraceResponseHeader();
                    app.Run(terminal);
                }))
            .StartAsync();
}
