using Infrastructure.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class HealthCheckBuilderExtensions
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public const string ReadinessTag = "Readiness";

    public static IHealthChecksBuilder AddReadinessChecks(
        this IHealthChecksBuilder builder,
        IConfiguration configuration)
    {
        var tags = new[] { ReadinessTag };

        var mongoDbConnectionString = configuration["MongoDb:ConnectionString"];
        var redisConnectionString = configuration["Redis:ConnectionString"];

        if (string.IsNullOrEmpty(mongoDbConnectionString) || string.IsNullOrEmpty(redisConnectionString))
        {
            throw new InvalidOperationException("MongoDb and Redis connection strings must be configured.");
        }

        builder.Services
            .AddHealthChecks()
            .AddMongoDb(
                mongoDbConnectionString,
                tags: tags,
                timeout: Timeout
            )
            .AddRedis(
                redisConnectionString,
                tags: tags,
                timeout: Timeout
            );

        if (configuration.IsProVersion())
        {
            builder.AddKafka(configuration, tags, Timeout);
        }

        return builder;
    }
}