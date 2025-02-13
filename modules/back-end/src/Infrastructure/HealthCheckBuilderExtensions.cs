using Infrastructure.Kafka;
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

        builder.AddDbContextCheck<AppDbContext>(tags: tags);

        var provider = configuration.GetDbProvider();
        if (provider.Name == DbProvider.MongoDb)
        {
            builder.AddMongoDb(
                provider.ConnectionString,
                tags: tags,
                timeout: Timeout
            );
        }
        else
        {
            builder.AddDbContextCheck<AppDbContext>(tags: tags);
        }

        // add redis health check
        var redisConnectionString = configuration.GetValue<string>("Redis:ConnectionString")!;
        builder.AddRedis(
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