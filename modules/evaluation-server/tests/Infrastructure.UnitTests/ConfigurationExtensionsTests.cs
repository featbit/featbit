using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.UnitTests;

public class ConfigurationExtensionsTests
{
    private static IConfiguration Build(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public void GetMqProvider_NotConfigured_DefaultsToRedis()
    {
        var configuration = Build(new());

        Assert.Equal(MqProvider.Redis, configuration.GetMqProvider());
    }

    [Theory]
    [InlineData(MqProvider.None)]
    [InlineData(MqProvider.Redis)]
    [InlineData(MqProvider.Kafka)]
    [InlineData(MqProvider.Postgres)]
    public void GetMqProvider_Configured_ReturnsConfiguredValue(string provider)
    {
        var configuration = Build(new() { [MqProvider.SectionName] = provider });

        Assert.Equal(provider, configuration.GetMqProvider());
    }

    [Fact]
    public void GetCacheProvider_NotConfigured_DefaultsToRedis()
    {
        var configuration = Build(new());

        Assert.Equal(CacheProvider.Redis, configuration.GetCacheProvider());
    }

    [Theory]
    [InlineData(CacheProvider.None)]
    [InlineData(CacheProvider.Redis)]
    public void GetCacheProvider_Configured_ReturnsConfiguredValue(string provider)
    {
        var configuration = Build(new() { [CacheProvider.SectionName] = provider });

        Assert.Equal(provider, configuration.GetCacheProvider());
    }

    [Fact]
    public void GetDbProvider_NotConfigured_DefaultsToMongoDbWithEmptyConnectionString()
    {
        var configuration = Build(new());

        var provider = configuration.GetDbProvider();

        Assert.Equal(DbProvider.MongoDb, provider.Name);
        Assert.Equal(string.Empty, provider.ConnectionString);
    }

    [Fact]
    public void GetDbProvider_Configured_ReturnsNameAndConnectionStringFromMatchingSection()
    {
        var configuration = Build(new()
        {
            [DbProvider.SectionName] = DbProvider.Postgres,
            ["Postgres:ConnectionString"] = "Host=db"
        });

        var provider = configuration.GetDbProvider();

        Assert.Equal(DbProvider.Postgres, provider.Name);
        Assert.Equal("Host=db", provider.ConnectionString);
    }

    [Fact]
    public void GetRedisConnectionString_NoPasswordConfigured_PreservesOriginalConnectionString()
    {
        var configuration = Build(new()
        {
            ["Redis:ConnectionString"] = "localhost:6379"
        });

        var connectionString = configuration.GetRedisConnectionString();

        Assert.Contains("localhost:6379", connectionString);
    }

    [Fact]
    public void GetRedisConnectionString_PasswordConfigured_AppliesPasswordToConnectionString()
    {
        var configuration = Build(new()
        {
            ["Redis:ConnectionString"] = "localhost:6379",
            ["Redis:Password"] = "s3cret"
        });

        var connectionString = configuration.GetRedisConnectionString();

        Assert.Contains("password=s3cret", connectionString);
    }

    [Fact]
    public void GetPostgresConnectionString_NoPasswordConfigured_PreservesOriginalBuilderOutput()
    {
        var configuration = Build(new()
        {
            ["Postgres:ConnectionString"] = "Host=localhost;Username=u"
        });

        var connectionString = configuration.GetPostgresConnectionString();

        Assert.Contains("Host=localhost", connectionString);
        Assert.Contains("Username=u", connectionString);
    }

    [Fact]
    public void GetPostgresConnectionString_PasswordConfigured_AppliesPasswordToConnectionString()
    {
        var configuration = Build(new()
        {
            ["Postgres:ConnectionString"] = "Host=localhost;Username=u",
            ["Postgres:Password"] = "pw"
        });

        var connectionString = configuration.GetPostgresConnectionString();

        Assert.Contains("Password=pw", connectionString);
    }
}
