using Api.Cors;
using Streaming;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Infrastructure;

namespace Api.Setup;

public static class MiddlewaresRegister
{
    public static WebApplication SetupMiddleware(this WebApplication app)
    {
        // reference: https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-6-adding-health-checks-with-liveness-readiness-and-startup-probes/
        // health check endpoints for external use
        app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        app.MapHealthChecks("health/readiness", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag)
        }).AllowAnonymous();

        // enable swagger in dev mode
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        // enable rate limiting (before streaming so WebSocket upgrades are covered)
        if (app.Configuration.IsRateLimitingEnabled())
        {
            app.UseRateLimiter();
        }

        // enable streaming before authorization so websocket upgrade requests
        // are validated by streaming middleware rather than fallback auth policy
        app.UseStreaming();

        // cors must run before authentication/authorization so that browser OPTIONS
        // preflight requests (which carry no Authorization header) receive CORS headers
        // before hitting the auth middleware and getting a 401.
        app.UseCustomCors();

        // authentication and authorization
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();

        return app;
    }
}