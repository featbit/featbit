using Api.Middlewares;
using Asp.Versioning.ApiExplorer;
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

        // OpenAPI JSON endpoints (all versions + the public doc): available in every environment,
        // matching the old Swashbuckle setup where app.UseSwagger() (the JSON endpoints) ran
        // unconditionally and only the interactive SwaggerUI was dev-gated.
        app.MapOpenApi().AllowAnonymous();

        // A reference scoped to just the public "OpenApi" doc: available in every environment too,
        // matching the old app.UseReDoc(), which was likewise unconditional.
        app.MapScalarApiReference("/docs", options =>
        {
            options.Title = "FeatBit Open Api";
            options.AddDocument(OpenApiConstants.ApiGroupName, OpenApiConstants.ApiGroupName);
        }).AllowAnonymous();

        // The full multi-document interactive reference (every API version + the public doc):
        // development-only, matching the old dev-only SwaggerUI.
        if (app.Environment.IsDevelopment())
        {
            app.MapScalarApiReference(options =>
            {
                options.Title = "FeatBit Backend";

                var versionProvider = app.Services.GetRequiredService<IApiVersionDescriptionProvider>();
                foreach (var description in versionProvider.ApiVersionDescriptions)
                {
                    options.AddDocument(description.GroupName, description.GroupName.ToUpperInvariant());
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