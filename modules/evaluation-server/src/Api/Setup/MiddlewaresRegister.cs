using Api.Cors;
using Domain.Observability;
using Streaming;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Infrastructure;
using Serilog;
using Serilog.Events;

using FeatBit.Observability.AspNetCore;

namespace Api.Setup;

public static class MiddlewaresRegister
{
    public static WebApplication SetupMiddleware(this WebApplication app)
    {
        // Correlation: emit the trace id as a response header before anything else can write a
        // response (docs/observability/index.md §7).
        app.UseTraceResponseHeader();

        // Request logging, matching the API and control plane. Without it the evaluation server
        // produced no record of an HTTP request at all, so a failing handshake was invisible.
        // The query string is excluded from RequestPath and re-attached with only credential
        // parameter values hashed: the SDK streaming token travels in the query string here, so a
        // raw path is a credential leak (docs/observability/index.md §7).
        app.UseSerilogRequestLogging(options =>
        {
            options.IncludeQueryInRequestPath = false;
            options.EnrichDiagnosticContext = (diagnosticContext, ctx) =>
                diagnosticContext.Set("QueryString", Redaction.QueryString(ctx.Request.QueryString.Value));
            options.GetLevel = (ctx, _, ex) =>
            {
                if (ex != null || ctx.Response.StatusCode > 499)
                {
                    return LogEventLevel.Error;
                }

                // health checks are polled continuously by the orchestrator
                if (ctx.Request.Path.StartsWithSegments("/health"))
                {
                    return LogEventLevel.Debug;
                }

                return LogEventLevel.Information;
            };
        });

        // reference: https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-6-adding-health-checks-with-liveness-readiness-and-startup-probes/
        // health check endpoints for external use
        app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        app.MapHealthChecks("health/readiness", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag)
        }).AllowAnonymous();

        // Startup probe. It reports the same dependency checks as readiness: startup and readiness
        // ask the same question, and differ only in how long an orchestrator is willing to wait for
        // the answer, which is a probe-manifest concern rather than a code one. The kubernetes/
        // manifests wire liveness and readiness only, so this endpoint stays inert until a
        // deployment references it.
        app.MapHealthChecks("health/startup", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.StartupTag)
        }).AllowAnonymous();

        // Diagnostic endpoint. Gates NOTHING: no orchestrator probe points at it, and its checks
        // are excluded from liveness and readiness by tag. That is what lets it answer in detail
        // (per-check status, duration, and structured data) instead of a bare status word.
        app.MapHealthChecks("health/diagnostics", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.DiagnosticsTag),
            ResponseWriter = HealthCheckResponseWriter.WriteAsync
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