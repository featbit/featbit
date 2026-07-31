using Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;

namespace Api.Setup;

public static class MiddlewareRegister
{
    public static WebApplication SetupMiddleware(this WebApplication app)
    {
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

        app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
        app.MapHealthChecks("health/readiness", new HealthCheckOptions()
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag)
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