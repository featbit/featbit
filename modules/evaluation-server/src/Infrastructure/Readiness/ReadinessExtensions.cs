using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Infrastructure.MongoDb;
using Infrastructure.Redis;
using Infrastructure.Kafka;

namespace Infrastructure.Readiness;

public static class ReadinessExtensions
{
    public const string ReadinessTag = "Readiness";

    public static IHealthChecksBuilder AddReadinessChecks(this IHealthChecksBuilder builder, IConfiguration configuration)
    {
        var tags = new string[] { ReadinessTag };

        builder.AddCheck<MongoDbReadinessCheck>("Check If MongoDB Is Available", tags: tags)
            .AddCheck<RedisReadinessCheck>("Check If Redis Is Available", tags: tags);

        if (configuration.IsFeatBitPro())
        {
            builder.AddCheck<KafkaReadinessCheck>("Check If Kafka Is Available", tags: tags);
        }

        return builder;
    }

    private static bool IsFeatBitPro(this IConfiguration configuration)
        => configuration["IS_PRO"].Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase);
}
