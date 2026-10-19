using Api.Middlewares;
using Api.Setup.OpenApi;
using Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;
using OpenApiConstants = Api.Authentication.OpenApiConstants;

namespace Api.Setup;

public static class MiddlewaresRegister
{
    public static WebApplication SetupMiddleware(this WebApplication app)
    {
        app.UseApiExceptionHandler();

        // reference: https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-6-adding-health-checks-with-liveness-readiness-and-startup-probes/
        // health check endpoints
        // external use
        app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("health/readiness", new HealthCheckOptions()
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag)
        });

        // OpenAPI JSON endpoints
        app.MapOpenApi().AllowAnonymous();

        // API reference for the public "OpenApi" doc only
        app.MapScalarApiReference("/docs", options =>
        {
            options.Title = "FeatBit Open Api";
            options.AddDocument(OpenApiConstants.ApiGroupName, OpenApiConstants.ApiGroupName);
        }).AllowAnonymous();

        // Full API reference
        if (app.Environment.IsDevelopment())
        {
            app.MapScalarApiReference(options =>
            {
                options.Title = "FeatBit Backend";

                foreach (var version in OpenApiSetup.SupportedApiVersions)
                {
                    var groupName = version.ToString(OpenApiSetup.ApiGroupNameFormat);
                    options.AddDocument(groupName, groupName.ToUpperInvariant());
                }

                options.AddDocument(OpenApiConstants.ApiGroupName, OpenApiConstants.ApiGroupName);
            }).AllowAnonymous();
        }

        // enable cors
        app.UseCors();

        // serilog request logging
        app.UseSerilogRequestLogging(options =>
        {
            options.IncludeQueryInRequestPath = true;
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