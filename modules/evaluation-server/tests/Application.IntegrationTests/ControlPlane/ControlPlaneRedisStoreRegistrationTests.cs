using Api.Setup;
using Domain.ControlPlane;
using Domain.Shared;
using Infrastructure.Caches;
using Infrastructure.Fakes;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Infrastructure.Store;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Streaming.ControlPlane;

namespace Application.IntegrationTests.ControlPlane;

public class ControlPlaneRedisStoreRegistrationTests
{
    [Theory]
    [InlineData(false, CacheProvider.Redis, ConsistencyMode.GatedCommit, typeof(RedisStore))]
    [InlineData(true, CacheProvider.Redis, null, typeof(RedisStore))]
    [InlineData(true, CacheProvider.Redis, ConsistencyMode.BestEffort, typeof(RedisStore))]
    [InlineData(true, CacheProvider.Redis, ConsistencyMode.GatedCommit, typeof(GatedCommitRedisStore))]
    [InlineData(true, CacheProvider.None, ConsistencyMode.GatedCommit, typeof(GatedCommitRedisStore))]
    public void RegisterServices_ControlPlaneConfiguration_RegistersExpectedStore(
        bool controlPlaneEnabled,
        string cacheProvider,
        ConsistencyMode? consistencyMode,
        Type expectedRedisStoreType)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            [DbProvider.SectionName] = DbProvider.Fake,
            [MqProvider.SectionName] = MqProvider.None,
            [CacheProvider.SectionName] = cacheProvider,
            ["ControlPlane:Enabled"] = controlPlaneEnabled.ToString(),
            ["ControlPlane:ConsistencyMode"] = consistencyMode?.ToString(),
            ["Redis:ConnectionString"] = "localhost:6379"
        });

        builder.RegisterServices();

        var stores = builder.Services.Where(x => x.ServiceType == typeof(IDbStore)).ToList();
        Assert.Equal(typeof(FakeStore), stores[0].ImplementationType);
        Assert.Equal(expectedRedisStoreType, stores[^1].ImplementationType);
        Assert.Equal(2, stores.Count);
    }
}