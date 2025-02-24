using Infrastructure;

namespace Api.Setup;

public static class ConfigurationExtensions
{
    public static void ValidateOnStart(this IConfiguration configuration)
    {
        EnsureDbProviderConfigured();
        EnsureRedisConfigured();

        return;

        void EnsureDbProviderConfigured()
        {
            var dbProvider = configuration.GetDbProvider();
            if (!dbProvider.IsValid())
            {
                throw new InvalidOperationException("Invalid db provider configuration.");
            }
        }

        void EnsureRedisConfigured()
        {
            var redisConnectionString = configuration.GetValue<string>("Redis:ConnectionString");
            if (string.IsNullOrWhiteSpace(redisConnectionString))
            {
                throw new InvalidOperationException("Redis connection string must be configured.");
            }
        }
    }
}