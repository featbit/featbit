using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;

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
}