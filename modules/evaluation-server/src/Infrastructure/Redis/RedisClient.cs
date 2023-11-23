using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public class RedisClient : IRedisClient
{
    private readonly Lazy<ConnectionMultiplexer> _lazyConnection;
    private IConnectionMultiplexer ConnectionMultiplexer => _lazyConnection.Value;

    public RedisClient(IOptions<RedisOptions> options)
    {
        var value = options.Value;

        var connectionString = value.ConnectionString;
        var configurationOptions = ConfigurationOptions.Parse(connectionString);

        // if user has specified a password in the configuration, use it
        var password = value.Password;
        if (!string.IsNullOrWhiteSpace(password))
        {
            configurationOptions.Password = password;
        }

        _lazyConnection = new Lazy<ConnectionMultiplexer>(
            () => StackExchange.Redis.ConnectionMultiplexer.Connect(configurationOptions)
        );
    }

    public bool IsConnected => ConnectionMultiplexer.IsConnected;

    public IDatabase GetDatabase() => ConnectionMultiplexer.GetDatabase();

    public ISubscriber GetSubscriber() => ConnectionMultiplexer.GetSubscriber();
}