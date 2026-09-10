using Domain.Observability;
using Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;

using FeatBit.Observability.AspNetCore;

namespace Api.Setup;

public static class MiddlewareRegister
{
    public static WebApplication SetupMiddleware(this WebApplication app)
    {
        // Correlation: emit the trace id as a response header before anything else can write a
        // response (docs/observability/index.md §7).
        app.UseTraceResponseHeader();

        app.UseSerilogRequestLogging(options =>
        {
            // The query string is excluded from RequestPath and re-attached with only credential
            // parameter values hashed, so credentials passed as query parameters never reach the
            // log while every other parameter stays legible (docs/observability/index.md §7).
            options.IncludeQueryInRequestPath = false;
            options.EnrichDiagnosticContext = (diagnosticContext, ctx) =>
                diagnosticContext.Set("QueryString", Redaction.QueryString(ctx.Request.QueryString.Value));
            options.GetLevel = (ctx, _, ex) =>
            {
                if (ex != null || ctx.Response.StatusCode > 499)
                {
                    return LogEventLevel.Error;
                }

                // ignore health check endpoints
                if (ctx.Request.Path.StartsWithSegments("/health"))
                {
                    return LogEventLevel.Debug;
                }

                return LogEventLevel.Information;
            };
        });

        app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        app.MapHealthChecks("health/readiness", new HealthCheckOptions()
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag)
        }).AllowAnonymous();

        // Startup probe. Additive and inert until a manifest references it (kubernetes/ manifests
        // are deliberately not modified here — see follow-up F10). It reports the same dependency
        // checks as readiness: startup and readiness ask the same question, and differ only in how
        // long an orchestrator waits for the answer, which is a probe-manifest concern.
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

        app.UseAuthentication();
        app.UseAuthorization();

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi().AllowAnonymous();
    
            app.MapScalarApiReference();
        }

        app.UseHttpsRedirection();

        app.MapControllers();

        return app;
    }
}