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

        var mongoDbConnectionString = configuration.GetValue<string>("MongoDb:ConnectionString");
        var redisConnectionString = configuration.GetValue<string>("Redis:ConnectionString");

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

        if(configuration.IsProVersion())
        {
            builder.AddKafka(configuration, tags, Timeout);
        }

        return builder;
    }
}
