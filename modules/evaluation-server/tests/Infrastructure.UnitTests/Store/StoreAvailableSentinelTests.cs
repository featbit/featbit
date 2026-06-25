using Domain.Shared;
using Infrastructure.Store;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Xunit;

namespace Infrastructure.UnitTests.Store;

[Collection(StoreSingletonCollection.Name)]
public class StoreAvailableSentinelTests
{
    private readonly IServiceProvider _serviceProvider;

    private const string DbStore1Name = "0_dbStore";
    private const string DbStore2Name = "1_dbStore";

    private readonly Mock<IDbStore> _dbStore1 = new();
    private readonly Mock<IDbStore> _dbStore2 = new();
    private readonly IDbStore[] _dbStores;

    private readonly FakeLogger<StoreAvailableSentinel> _logger = new();

    public StoreAvailableSentinelTests()
    {
        var serviceCollection = new ServiceCollection();

        _dbStore1.Setup(x => x.Name).Returns(DbStore1Name);
        _dbStore2.Setup(x => x.Name).Returns(DbStore2Name);
        _dbStores = [_dbStore1.Object, _dbStore2.Object];

        var mockedStore = Mock.Of<IStore>();
        serviceCollection.AddSingleton(mockedStore);

        _serviceProvider = serviceCollection.BuildServiceProvider();
    }

    [Theory]
    [ClassData(typeof(StoreAvailabilityData))]
    public async Task SetAvailableStoreAsync_StoreHealthCombination_SelectsExpectedStore(
        bool isDbStore1Healthy,
        bool isDbStore2Healthy,
        string expectedStore)
    {
        var sentinel = new StoreAvailableSentinel(_serviceProvider, _dbStores, _logger);
        _dbStore1.Setup(x => x.IsAvailableAsync()).ReturnsAsync(isDbStore1Healthy);
        _dbStore2.Setup(x => x.IsAvailableAsync()).ReturnsAsync(isDbStore2Healthy);

        await sentinel.SetAvailableStoreAsync(TimeSpan.FromMilliseconds(100), CancellationToken.None);

        _dbStore1.Verify(x => x.IsAvailableAsync(), Times.Once);
        _dbStore2.Verify(x => x.IsAvailableAsync(), isDbStore1Healthy ? Times.Never : Times.Once);
        Assert.Equal(expectedStore, StoreAvailabilityListener.Instance.AvailableStore);

        if (!isDbStore1Healthy && !isDbStore2Healthy)
        {
            var latestRecord = _logger.LatestRecord;
            Assert.Equal(LogLevel.Error, latestRecord.Level);
            Assert.Equal("No available store can be used.", latestRecord.Message);
            Assert.Null(latestRecord.Exception);
        }
    }

    [Fact]
    public async Task SetAvailableStoreAsync_FirstStoreNeverResponds_TimesOutAndFallsBackToSecondStore()
    {
        var sentinel = new StoreAvailableSentinel(_serviceProvider, _dbStores, _logger);
        var firstStoreNeverCompletes = new TaskCompletionSource<bool>();
        _dbStore1.Setup(x => x.IsAvailableAsync()).Returns(firstStoreNeverCompletes.Task);
        _dbStore2.Setup(x => x.IsAvailableAsync()).ReturnsAsync(true);

        await sentinel.SetAvailableStoreAsync(TimeSpan.FromMilliseconds(100), CancellationToken.None);

        _dbStore1.Verify(x => x.IsAvailableAsync(), Times.Once);
        _dbStore2.Verify(x => x.IsAvailableAsync(), Times.Once);
        Assert.Equal(DbStore2Name, StoreAvailabilityListener.Instance.AvailableStore);

        var latestRecord = _logger.LatestRecord;
        Assert.Equal(LogLevel.Debug, latestRecord.Level);
        Assert.Equal($"Store availability check timed out for {DbStore1Name}.", latestRecord.Message);
        Assert.Null(latestRecord.Exception);
    }
}

internal class StoreAvailabilityData : TheoryData<bool, bool, string>
{
    public StoreAvailabilityData()
    {
        Add(true, true, "0_dbStore");
        Add(false, true, "1_dbStore");
        Add(true, false, "0_dbStore");
        Add(false, false, "0_dbStore");
    }
}
