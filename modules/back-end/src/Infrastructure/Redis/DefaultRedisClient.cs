using Microsoft.Extensions.Configuration;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class DefaultRedisClient : IRedisClient
{
    private readonly Lazy<ConnectionMultiplexer> _lazyConnection;
    private ConnectionMultiplexer ConnectionMultiplexer => _lazyConnection.Value;

    public IDatabase GetDatabase() => ConnectionMultiplexer.GetDatabase();

    public DefaultRedisClient(IConfiguration configuration)
    {
        var connectionString = configuration["Redis:ConnectionString"];
        var options = ConfigurationOptions.Parse(connectionString);

        // if user has specified a password in the configuration, use it
        var password = configuration["Redis:Password"];
        if (!string.IsNullOrWhiteSpace(password))
        {
            options.Password = password;
        }

        _lazyConnection = new Lazy<ConnectionMultiplexer>(
            () => ConnectionMultiplexer.Connect(options)
        );
    }
}