using Api.Cors;
using Streaming;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Infrastructure;
using Microsoft.Extensions.Options;

namespace Api.Setup;

public static class MiddlewaresRegister
{
    public static WebApplication SetupMiddleware(this WebApplication app)
    {
        // reference: https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-6-adding-health-checks-with-liveness-readiness-and-startup-probes/
        // health check endpoints for external use
        app.MapHealthChecks("health/liveness", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("health/readiness", new HealthCheckOptions
        {
            Predicate = registration => registration.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag)
        });

        // enable cors when configured
        var corsOptions = app.Services.GetRequiredService<IOptions<CorsOptions>>().Value;
        if (corsOptions.Enabled)
        {
            app.UseCors(policy =>
            {
                if (corsOptions.AllowAnyOrigins)
                    policy.AllowAnyOrigin();
                else
                    policy.WithOrigins(corsOptions.AllowedOrigins);

                if (corsOptions.AllowAnyHeaders)
                    policy.AllowAnyHeader();
                else
                    policy.WithHeaders(corsOptions.AllowedHeaders);

                if (corsOptions.AllowAnyMethods)
                    policy.AllowAnyMethod();
                else
                    policy.WithMethods(corsOptions.AllowedMethods);

                if (corsOptions.AllowCredentials)
                    policy.AllowCredentials();
                else
                    policy.DisallowCredentials();
            });
        }

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

        // enable streaming
        app.UseStreaming();

        app.MapControllers();

        return app;
    }
}