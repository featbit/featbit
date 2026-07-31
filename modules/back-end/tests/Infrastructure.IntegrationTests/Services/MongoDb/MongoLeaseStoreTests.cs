using Application.ControlPlane;
using Domain.ControlPlane;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

/// <summary>
/// Integration tests for <see cref="MongoLeaseStore"/> that run against a real MongoDB instance.
/// Each run uses the shared MongoDB Testcontainers fixture with a throwaway database that is dropped on disposal.
/// </summary>
[Collection(MongoCollection.Name)]
public class MongoLeaseStoreTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _fixture;

    public MongoLeaseStoreTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    private static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private readonly string _databaseName = $"featbit_a3_test_{Guid.NewGuid():N}";
    private MongoClient _client = null!;
    private MongoLeaseStore _sut = null!;

    public Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return Task.CompletedTask;
        }

        _client = new MongoClient(_fixture.ConnectionString);

        var options = Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = _databaseName
        });

        var mongoDb = new MongoDbClient(options);
        _sut = new MongoLeaseStore(mongoDb);

        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        await _client.DropDatabaseAsync(_databaseName);
    }

    [DockerFact]
    public async Task UpsertLeaseAsync_IsIdempotentOnDcId()
    {
        var now = DateTimeOffset.UtcNow;

        var first = new DcLease
        {
            DcId = "dc-west",
            Region = "us-west",
            LastHeartbeatAt = now,
            LeaseExpiresAt = now.AddMinutes(5)
        };
        await _sut.UpsertLeaseAsync(first);

        // upsert again with the same DcId but a refreshed expiry -> must replace, not duplicate
        var second = new DcLease
        {
            DcId = "dc-west",
            Region = "us-west-2",
            LastHeartbeatAt = now.AddSeconds(30),
            LeaseExpiresAt = now.AddMinutes(10)
        };
        await _sut.UpsertLeaseAsync(second);

        var live = await _sut.GetLiveSetAsync(now);

        Assert.Single(live);
        Assert.Equal("dc-west", live[0].DcId);
        Assert.Equal("us-west-2", live[0].Region);
        Assert.Equal(second.LeaseExpiresAt.ToUnixTimeMilliseconds(), live[0].LeaseExpiresAt.ToUnixTimeMilliseconds());
    }

    [DockerFact]
    public async Task GetLiveSetAsync_ExcludesExpiredLeases()
    {
        var now = DateTimeOffset.UtcNow;

        var liveLease = new DcLease
        {
            DcId = "dc-east",
            Region = "us-east",
            LastHeartbeatAt = now,
            LeaseExpiresAt = now.AddMinutes(5)
        };
        var expiredLease = new DcLease
        {
            DcId = "dc-stale",
            Region = "us-stale",
            LastHeartbeatAt = now.AddMinutes(-10),
            LeaseExpiresAt = now.AddMinutes(-5)
        };

        await _sut.UpsertLeaseAsync(liveLease);
        await _sut.UpsertLeaseAsync(expiredLease);

        var live = await _sut.GetLiveSetAsync(now);

        Assert.Single(live);
        Assert.Equal("dc-east", live[0].DcId);
    }

    [DockerFact]
    public async Task UpdateAppliedWatermarkAsync_PersistsWatermark()
    {
        var now = DateTimeOffset.UtcNow;

        var lease = new DcLease
        {
            DcId = "dc-watermark",
            Region = "us-west",
            LastHeartbeatAt = now,
            LeaseExpiresAt = now.AddMinutes(5)
        };
        await _sut.UpsertLeaseAsync(lease);

        await _sut.UpdateAppliedWatermarkAsync("dc-watermark", EnvId, 99);

        var live = await _sut.GetLiveSetAsync(now);
        var stored = Assert.Single(live);

        Assert.True(stored.AppliedWatermarks.ContainsKey(EnvId));
        Assert.Equal(99, stored.AppliedWatermarks[EnvId]);

        // updating again overwrites the prior value
        await _sut.UpdateAppliedWatermarkAsync("dc-watermark", EnvId, 123);

        var reloaded = (await _sut.GetLiveSetAsync(now)).Single();
        Assert.Equal(123, reloaded.AppliedWatermarks[EnvId]);
    }
}
