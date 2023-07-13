using Api.Middlewares;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Serilog;
using Serilog.Events;
using Swashbuckle.AspNetCore.SwaggerUI;
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

        app.MapControllers();

        return app;
    }
}