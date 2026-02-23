using Confluent.Kafka;
using HealthChecks.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.MQ.Kafka;

public static class KafkaHealthCheckBuilderExtensions
{
    private const string DefaultTopic = "healthchecks-topic";

    public static IHealthChecksBuilder AddKafka(
        this IHealthChecksBuilder builder,
        IConfiguration configuration,
        string[] tags,
        TimeSpan timeout)
    {
        var producerConfig = BuildHealthCheckProducerConfig(configuration.GetSection("Kafka:Producer"));
        var consumerConfig = BuildHealthCheckProducerConfig(configuration.GetSection("Kafka:Consumer"));

        builder
            .AddKafka(
                "Kafka Producer Cluster",
                producerConfig,
                tags,
                timeout
            )
            .AddKafka(
                "Kafka Consumer Cluster",
                consumerConfig,
                tags,
                timeout
            );

        return builder;
    }

    private static IHealthChecksBuilder AddKafka(
        this IHealthChecksBuilder builder,
        string name,
        ProducerConfig producerConfig,
        IEnumerable<string> tags,
        TimeSpan timeout)
    {
        var kafkaConfig = new KafkaHealthCheckOptions
        {
            Configuration = producerConfig,
            Topic = DefaultTopic
        };

        var checker = new KafkaHealthCheck(kafkaConfig);
        var registration = new HealthCheckRegistration(
            name,
            checker,
            HealthStatus.Unhealthy,
            tags,
            timeout
        );

        return builder.Add(registration);
    }

    private static ProducerConfig BuildHealthCheckProducerConfig(IConfigurationSection section)
    {
        var configDictionary = new Dictionary<string, string>();
        section.Bind(configDictionary);

        if (!configDictionary.ContainsKey("bootstrap.servers"))
        {
            throw new InvalidOperationException($"{section.Path}:bootstrap.servers must be configured.");
        }

        return new ProducerConfig(configDictionary);
    }
}