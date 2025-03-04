using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;

namespace Infrastructure;

public static class ConfigurationExtensions
{
    public static bool IsProVersion(this IConfiguration configuration)
    {
        var isPro = configuration["IS_PRO"];

        return string.Equals(isPro, bool.TrueString, StringComparison.OrdinalIgnoreCase);
    }

    public static DbProvider GetDbProvider(this IConfiguration configuration)
    {
        var name = configuration.GetValue("DbProvider", DbProvider.MongoDb)!;
        var connectionString = configuration.GetSection(name).GetValue("ConnectionString", string.Empty)!;

        return new DbProvider
        {
            Name = name,
            ConnectionString = connectionString
        };
    }
}