using System;
using System.Threading;
using System.Threading.Tasks;
using Domain.Shared;
using Infrastructure.MongoDb;
using Infrastructure.Redis;
using Infrastructure.Store;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using TestBase;
using Xunit;

namespace Infrastructure.UnitTests;

public class StoreAvailableSentinelTests
{
    private readonly IServiceProvider _serviceProvider;
    private readonly Mock<IRedisClient> _redisClientMock = new();
    private readonly Mock<IMongoDbClient> _mongoDbClientMock = new();
    private readonly InMemoryFakeLogger<StoreAvailableSentinel> _logger = new();

    public StoreAvailableSentinelTests()
    {
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddSingleton<IStore, EmptyStore>();
        _serviceProvider = serviceCollection.BuildServiceProvider();
    }

    [Theory]
    [ClassData(typeof(StoreAvailabilityData))]
    public async Task TestSetAvailableStore(bool isRedisHealthy, bool isMongoDbHealthy, string expectedStore)
    {
        var sentinel = new StoreAvailableSentinel(
            _serviceProvider,
            _redisClientMock.Object,
            _mongoDbClientMock.Object,
            _logger
        );

        _redisClientMock.Setup(x => x.IsHealthyAsync()).ReturnsAsync(isRedisHealthy);
        _mongoDbClientMock.Setup(x => x.IsHealthyAsync()).ReturnsAsync(isMongoDbHealthy);

        var cts = new CancellationTokenSource();
        await sentinel.SetAvailableStoreAsync(TimeSpan.FromMilliseconds(100), cts.Token);

        _redisClientMock.Verify(x => x.IsHealthyAsync(), Times.Once);
        _mongoDbClientMock.Verify(x => x.IsHealthyAsync(), isRedisHealthy ? Times.Never : Times.Once);

        Assert.Equal(expectedStore, StoreAvailabilityListener.Instance.AvailableStore);

        if (!isRedisHealthy && !isMongoDbHealthy)
        {
            Assert.Equal(LogLevel.Error, _logger.Level);
            Assert.Equal("No available store can be used.", _logger.Message);
            Assert.Null(_logger.Ex);
        }
    }

    [Fact]
    public async Task TestCheckStoreAvailabilityTimeout()
    {
        var sentinel = new StoreAvailableSentinel(
            _serviceProvider,
            _redisClientMock.Object,
            _mongoDbClientMock.Object,
            _logger
        );

        var timeoutForCheckRedisHealth = TimeSpan.FromMilliseconds(1000);
        _redisClientMock.Setup(x => x.IsHealthyAsync())
            .Returns(() => Task.Delay(timeoutForCheckRedisHealth).ContinueWith(_ => true));
        _mongoDbClientMock.Setup(x => x.IsHealthyAsync()).ReturnsAsync(true);

        var cts = new CancellationTokenSource();
        var timeout = TimeSpan.FromMilliseconds(100);
        await sentinel.SetAvailableStoreAsync(timeout, cts.Token);

        _redisClientMock.Verify(x => x.IsHealthyAsync(), Times.Once);
        _mongoDbClientMock.Verify(x => x.IsHealthyAsync(), Times.Once);

        Assert.Equal(Stores.MongoDb, StoreAvailabilityListener.Instance.AvailableStore);

        Assert.Equal(LogLevel.Debug, _logger.Level);
        Assert.Equal($"Store availability check timed out for {Stores.Redis}.", _logger.Message);
        Assert.Null(_logger.Ex);
    }
}

class StoreAvailabilityData : TheoryData<bool, bool, string>
{
    public StoreAvailabilityData()
    {
        Add(true, true, Stores.Redis);
        Add(false, true, Stores.MongoDb);
        Add(true, false, Stores.Redis);
        Add(false, false, Stores.None);
    }
}