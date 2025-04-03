using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace Infrastructure;

public static class ConfigurationExtensions
{
    public static string GetMqProvider(this IConfiguration configuration)
    {
        var provider = configuration.GetValue(MqProvider.SectionName, MqProvider.Redis)!;
        return provider;
    }

    public static DbProvider GetDbProvider(this IConfiguration configuration)
    {
        var name = configuration.GetValue(DbProvider.SectionName, DbProvider.MongoDb)!;
        var connectionString = configuration.GetSection(name).GetValue("ConnectionString", string.Empty)!;

        return new DbProvider
        {
            Name = name,
            ConnectionString = connectionString
        };
    }

    public static string GetCacheProvider(this IConfiguration configuration)
    {
        var provider = configuration.GetValue(CacheProvider.SectionName, CacheProvider.Redis)!;
        return provider;
    }

    public static string GetRedisConnectionString(this IConfiguration configuration)
    {
        var connectionString = configuration["Redis:ConnectionString"];
        var options = ConfigurationOptions.Parse(connectionString!);

        // if we specified a password in the configuration, use it
        var password = configuration["Redis:Password"];
        if (!string.IsNullOrWhiteSpace(password))
        {
            options.Password = password;
        }

        return options.ToString(includePassword: true);
    }

    public static string GetPostgresConnectionString(this IConfiguration configuration)
        => configuration["Postgres:ConnectionString"]!;
}