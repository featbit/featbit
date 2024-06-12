using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class HealthCheckBuilderExtensions
{
    public const string ReadinessTag = "Readiness";

    public static IHealthChecksBuilder AddReadinessChecks(
        this IHealthChecksBuilder builder,
        IConfiguration configuration)
    {
        var readinessTags = new string[] { ReadinessTag };
        var timeoutFiveSeconds = TimeSpan.FromSeconds(5);

        var mongoDbConnectionString = configuration.GetValue<string>("MongoDb:ConnectionString");
        var redisConnectionString = configuration.GetValue<string>("Redis:ConnectionString");

        builder.Services
            .AddHealthChecks()
            .AddMongoDb(
                mongoDbConnectionString,
                tags: readinessTags,
                timeout: timeoutFiveSeconds
            )
            .AddRedis(
                redisConnectionString,
                tags: readinessTags,
                timeout: timeoutFiveSeconds
            );

        if (configuration.IsProVersion())
        {
            var producerHost = configuration.GetValue<string>("Kafka:Producer:bootstrap.servers");
            var consumerHost = configuration.GetValue<string>("Kafka:Consumer:bootstrap.servers");

            builder
                .AddKafka(
                    new ProducerConfig
                    {
                        BootstrapServers = consumerHost
                    },
                    name: "Check if Kafka consumer is available.",
                    tags: readinessTags,
                    timeout: timeoutFiveSeconds
                )
                .AddKafka(
                    new ProducerConfig
                    {
                        BootstrapServers = producerHost
                    },
                    name: "Check if Kafka producer is available.",
                    tags: readinessTags,
                    timeout: timeoutFiveSeconds
                );
        }

        return builder;
    }
}