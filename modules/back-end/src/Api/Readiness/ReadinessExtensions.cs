using Confluent.Kafka;
using Infrastructure.Kafka;

namespace Api.Readiness;

public static class ReadinessExtensions
{
    public static IHealthChecksBuilder AddReadinessChecks(this IHealthChecksBuilder builder, IConfiguration configuration)
    {
        var readinessTags = new string[] { ReadinessConstants.ReadinessTag };
        var timeoutFiveSeconds = TimeSpan.FromSeconds(5);

        var mongoDbConnectionString = configuration.GetValue<string>("MongoDb:ConnectionString");
        var redisConnectionString = configuration.GetValue<string>("Redis:ConnectionString");
        
        builder.Services.AddHealthChecks()
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

        if (configuration.IsFeatBitPro())
        {
            var kafkaProducerHost = configuration.GetValue<string>("Kafka:Producer:bootstrap.servers");
            builder.AddCheck<KafkaReadinessCheck>(
                "Check if Kafka consumer is available.",
                tags: readinessTags,
                timeout: timeoutFiveSeconds
            ).AddKafka(
                new ProducerConfig
                {
                    BootstrapServers = kafkaProducerHost
                },
                name: "Check if Kafka producer is available.",
                tags: readinessTags,
                timeout: timeoutFiveSeconds
            );
        }

        return builder;
    }

    private static bool IsFeatBitPro(this IConfiguration configuration)
    {
        var configValue = configuration["IS_PRO"];
        return configValue != null && configValue.Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase);
    }
}
