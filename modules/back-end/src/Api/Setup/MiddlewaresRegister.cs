using Api.Middlewares;
using Domain.Observability;
using Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;
using Serilog.Events;
using Swashbuckle.AspNetCore.SwaggerUI;
using OpenApiConstants = Api.Authentication.OpenApiConstants;

using FeatBit.Observability.AspNetCore;

namespace Api.Setup;

public static class MiddlewaresRegister
{
    public static WebApplication SetupMiddleware(this WebApplication app)
    {
        // Correlation: emit the trace id as a response header before anything else can write a
        // response, so failed requests carry it too (docs/observability/index.md §7).
        app.UseTraceResponseHeader();

        app.UseApiExceptionHandler();

        // reference: https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-6-adding-health-checks-with-liveness-readiness-and-startup-probes/
        // health check endpoints
        // external use
        app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("health/readiness", new HealthCheckOptions()
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag)
        });

        // Startup probe. Additive and inert until a manifest references it (kubernetes/ manifests
        // are deliberately not modified here — see follow-up F10). It reports the same dependency
        // checks as readiness: startup and readiness ask the same question, and differ only in how
        // long an orchestrator waits for the answer, which is a probe-manifest concern.
        app.MapHealthChecks("health/startup", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.StartupTag)
        });

        // Diagnostic endpoint. Gates NOTHING: no orchestrator probe points at it, and its checks
        // are excluded from liveness and readiness by tag. That is what lets it answer in detail
        // (per-check status, duration, and structured data) instead of a bare status word.
        app.MapHealthChecks("health/diagnostics", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.DiagnosticsTag),
            ResponseWriter = HealthCheckResponseWriter.WriteAsync
        });

        // enable swagger
        app.UseSwagger();

        // enable swagger UI in development environment
        if (app.Environment.IsDevelopment())
        {
            app.UseSwaggerUI(options =>
            {
                options.EnableFilter();
                options.DisplayRequestDuration();
                options.DocExpansion(DocExpansion.List);

                // build a swagger endpoint for each discovered API version
                var descriptions = app.DescribeApiVersions();
                foreach (var description in descriptions)
                {
                    var url = $"/swagger/{description.GroupName}/swagger.json";
                    var name = description.GroupName.ToUpperInvariant();
                    options.SwaggerEndpoint(url, name);
                }

                const string openApiGroup = OpenApiConstants.ApiGroupName;
                options.SwaggerEndpoint($"/swagger/{openApiGroup}/swagger.json", openApiGroup);
            });
        }

        // enable ReDoc
        app.UseReDoc(options =>
        {
            options.RoutePrefix = "docs";
            options.DocumentTitle = "FeatBit OpenApi Doc";
            options.SpecUrl = $"/swagger/{OpenApiConstants.ApiGroupName}/swagger.json";
            options.ExpandResponses("200");
        });

        // enable cors
        app.UseCors();

        // serilog request logging
        app.UseSerilogRequestLogging(options =>
        {
            // The query string is excluded from RequestPath and re-attached with only credential
            // parameter values hashed: FeatBit passes SDK secrets and streaming tokens as query
            // parameters, so a raw path is a credential leak (docs/observability/index.md §7).
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

        // authentication & authorization
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapMcp("/mcp").RequireAuthorization();
        app.MapControllers();

        return app;
    }
}