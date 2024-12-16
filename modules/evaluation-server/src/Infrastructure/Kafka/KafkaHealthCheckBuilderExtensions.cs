﻿using Confluent.Kafka;
using HealthChecks.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Kafka;

public static class KafkaHealthCheckBuilderExtensions
{
    private const string DefaultTopic = "healthchecks-topic";

    public static IHealthChecksBuilder AddKafka(
        this IHealthChecksBuilder builder,
        IConfiguration configuration,
        string[] tags,
        TimeSpan timeout)
    {
        var producerServer = configuration["Kafka:Producer:bootstrap.servers"];
        var consumerServer = configuration["Kafka:Consumer:bootstrap.servers"];

        if (string.IsNullOrEmpty(producerServer) || string.IsNullOrEmpty(consumerServer))
        {
            throw new InvalidOperationException("Kafka producer and consumer servers must be configured.");
        }

        builder
            .AddKafka(
                "Kafka Producer Cluster",
                producerServer,
                tags,
                timeout
            )
            .AddKafka(
                "Kafka Consumer Cluster",
                consumerServer,
                tags,
                timeout
            );

        return builder;
    }

    private static IHealthChecksBuilder AddKafka(
        this IHealthChecksBuilder builder,
        string name,
        string bootstrapServers,
        IEnumerable<string> tags,
        TimeSpan timeout)
    {
        var producerConfig = new ProducerConfig
        {
            BootstrapServers = bootstrapServers
        };

        var kafkaOptions = new KafkaHealthCheckOptions
        {
            Configuration = producerConfig,
            Topic = DefaultTopic
        };

        var checker = new KafkaHealthCheck(kafkaOptions);
        var registration = new HealthCheckRegistration(
            name,
            checker,
            HealthStatus.Unhealthy,
            tags,
            timeout
        );

        return builder.Add(registration);
    }
}