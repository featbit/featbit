using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Infrastructure.Redis;
using Infrastructure.Kafka;

namespace Infrastructure.Readiness;

public static class ReadinessExtensions
{
    public static IHealthChecksBuilder AddReadinessChecks(this IHealthChecksBuilder builder, IConfiguration configuration)
    {            
        builder.AddCheck<MongoDbReadinessCheck>("Check If MongoDB Is Available")
            .AddCheck<RedisReadinessCheck>("Check If Redis Is Available");
        
        if (configuration.IsFeatBitPro())
        {
            builder.AddCheck<KafkaReadinessCheck>("Check If Kafka Is Available");
        }

        return builder;
    }

    private static bool IsFeatBitPro(this IConfiguration configuration)
        => configuration["IS_PRO"].Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase);
}
