using Infrastructure.MQ;
using Infrastructure.MQ.Kafka;
using Infrastructure.Persistence;
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

        var provider = configuration.GetDbProvider();
        switch (provider.Name)
        {
            case DbProvider.MongoDb:
                builder.AddMongoDb(
                    provider.ConnectionString,
                    tags: tags,
                    timeout: Timeout
                );
                break;
            case DbProvider.Postgres:
                builder.AddNpgSql();
                break;
        }

        // add redis health check
        var redisConnectionString = configuration.GetValue<string>("Redis:ConnectionString")!;
        builder.AddRedis(
            redisConnectionString,
            tags: tags,
            timeout: Timeout
        );

        var mqProvider = configuration.GetMqProvider();
        if (mqProvider == MqProvider.Kafka)
        {
            builder.AddKafka(configuration, tags, Timeout);
        }

        return builder;
    }
}