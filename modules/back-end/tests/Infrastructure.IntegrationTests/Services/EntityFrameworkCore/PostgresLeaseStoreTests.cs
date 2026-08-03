using Domain.ControlPlane;
using Domain.Utils;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

/// <summary>
/// Integration tests for <see cref="PostgresLeaseStore"/> that run against a real Postgres instance.
/// The shared Postgres Testcontainers database is reset and materialized via the EF model
/// (EnsureCreated) for each test class so state never leaks.
/// The Npgsql data source mirrors production (snake_case naming + dynamic json for the jsonb map).
/// </summary>
[Collection(PostgresCollection.Name)]
public class PostgresLeaseStoreTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;

    public PostgresLeaseStoreTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private readonly string _dbName = "pgleasestore_{Guid.NewGuid():N}";
    private string _connectionString = null!;

    private static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private NpgsqlDataSource _dataSource = null!;
    private AppDbContext _dbContext = null!;
    private PostgresLeaseStore _sut = null!;

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        _connectionString = new NpgsqlConnectionStringBuilder(_fixture.ConnectionString)
        {
            Database = _dbName
        }.ConnectionString;

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(_connectionString);
        dataSourceBuilder
            .EnableDynamicJson()
            .ConfigureJsonOptions(ReusableJsonSerializerOptions.Web);
        _dataSource = dataSourceBuilder.Build();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_dataSource)
            .UseSnakeCaseNamingConvention()
            .Options;

        _dbContext = new AppDbContext(options);

        await _dbContext.Database.EnsureDeletedAsync();
        // Materialize the EF model (including the DcLease configuration) into the throwaway db.
        await _dbContext.Database.EnsureCreatedAsync();

        _sut = new PostgresLeaseStore(_dbContext);
    }

    public async Task DisposeAsync()
    {
        await _dbContext.DisposeAsync();
        await _dataSource.DisposeAsync();
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
        Assert.Equal(
            second.LeaseExpiresAt.ToUnixTimeMilliseconds(),
            live[0].LeaseExpiresAt.ToUnixTimeMilliseconds());
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
