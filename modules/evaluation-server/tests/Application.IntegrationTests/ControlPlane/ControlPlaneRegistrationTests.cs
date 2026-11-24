using Api.ControlPlane;
using Domain.ControlPlane;
using Domain.Shared;
using Infrastructure.Caches;
using Infrastructure.Fakes;
using Infrastructure.Persistence;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Streaming.ControlPlane;
using Streaming.DependencyInjection;

namespace Application.IntegrationTests.ControlPlane;

public class ControlPlaneRegistrationTests
{
    [Theory]
    [InlineData(CacheProvider.Redis, null, typeof(RedisStore))]
    [InlineData(CacheProvider.Redis, ConsistencyMode.BestEffort, typeof(RedisStore))]
    [InlineData(CacheProvider.Redis, ConsistencyMode.GatedCommit, typeof(GatedCommitRedisStore))]
    [InlineData(CacheProvider.None, ConsistencyMode.GatedCommit, typeof(GatedCommitRedisStore))]
    public void AddControlPlane_ControlPlaneConfiguration_RegistersExpectedStore(
        string cacheProvider,
        ConsistencyMode? consistencyMode,
        Type expectedRedisStoreType)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [DbProvider.SectionName] = DbProvider.Fake,
            [CacheProvider.SectionName] = cacheProvider,
            ["ControlPlane:ConsistencyMode"] = consistencyMode?.ToString(),
            ["Redis:ConnectionString"] = "localhost:6379"
        }).Build();

        var services = new ServiceCollection();
        services.AddStreamingCore().UseStore(configuration);
        services.AddControlPlane(configuration);

        var stores = services.Where(x => x.ServiceType == typeof(IDbStore)).ToList();
        Assert.Equal(typeof(FakeStore), stores[0].ImplementationType);
        Assert.Equal(expectedRedisStoreType, stores[^1].ImplementationType);
        Assert.Equal(2, stores.Count);
    }

    /// <summary>
    /// Only <c>GatedCommit</c> reads the applied watermarks from Redis; with no mode set, or any other mode, the heartbeat
    /// gets the no-op reader.
    /// </summary>
    [Theory]
    [InlineData(null, typeof(NoOpAppliedWatermarkReader))]
    [InlineData(ConsistencyMode.BestEffort, typeof(NoOpAppliedWatermarkReader))]
    [InlineData(ConsistencyMode.GatedCommit, typeof(RedisAppliedWatermarkReader))]
    public void AddControlPlane_ConsistencyMode_RegistersExpectedWatermarkReader(
        ConsistencyMode? consistencyMode,
        Type expectedReaderType)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [DbProvider.SectionName] = DbProvider.Fake,
            [CacheProvider.SectionName] = CacheProvider.Redis,
            ["ControlPlane:ConsistencyMode"] = consistencyMode?.ToString(),
            ["Redis:ConnectionString"] = "localhost:6379"
        }).Build();

        var services = new ServiceCollection();
        services.AddStreamingCore().UseStore(configuration);
        services.AddControlPlane(configuration);

        var readers = services.Where(x => x.ServiceType == typeof(IAppliedWatermarkReader)).ToList();
        Assert.Equal(expectedReaderType, Assert.Single(readers).ImplementationType);
    }
}
