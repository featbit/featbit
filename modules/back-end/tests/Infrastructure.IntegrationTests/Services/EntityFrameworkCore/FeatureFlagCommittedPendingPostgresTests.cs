using Domain.FeatureFlags;
using Domain.Utils;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

/// <summary>
/// B4 acceptance (Postgres/EF parity with the Mongo B3 work): the authoritative committed
/// read must return the COMMITTED flag value, never a pending (staged-but-not-committed)
/// change. After promotion the committed read returns the new value.
///
/// Integration test against a real Postgres Testcontainers instance.
/// Uses EnsureCreated() to materialize the EF model — including the mapped
/// committed_version (bigint) and pending (jsonb) columns — so this also proves the
/// FeatureFlagConfiguration mapping is valid. Uses the shared Postgres Testcontainers fixture and resets the EF schema per test class.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class FeatureFlagCommittedPendingPostgresTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;

    public FeatureFlagCommittedPendingPostgresTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private readonly string _dbName = "featureflagcommittedpend_{Guid.NewGuid():N}";
    private string _connectionString = null!;

    private NpgsqlDataSource _dataSource = null!;
    private AppDbContext _dbContext = null!;
    private FeatureFlagService _sut = null!;
    private readonly Guid _envId = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        // Mirror the production data source: dynamic JSON is required for the jsonb
        // POCO columns (Variations/Rules/Fallthrough and the new Pending), and the
        // snake_case naming convention is required so EnsureCreated materializes the
        // expected committed_version / pending columns.
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
        // materializes the EF model (incl. the new committed_version/pending columns)
        await _dbContext.Database.EnsureDeletedAsync();
        await _dbContext.Database.EnsureCreatedAsync();

        _sut = new FeatureFlagService(_dbContext, NullLogger<FeatureFlagService>.Instance);
    }

    public async Task DisposeAsync()
    {
        if (_dbContext != null!)
        {
            await _dbContext.Database.EnsureDeletedAsync();
            await _dbContext.DisposeAsync();
        }

        if (_dataSource != null!)
        {
            await _dataSource.DisposeAsync();
        }
    }

    private FeatureFlag CreateFlag(string key, bool isEnabled)
    {
        var enabledVariationId = Guid.NewGuid().ToString();
        var disabledVariationId = Guid.NewGuid().ToString();

        var variations = new List<Variation>
        {
            new() { Id = enabledVariationId, Name = "true", Value = "true" },
            new() { Id = disabledVariationId, Name = "false", Value = "false" }
        };

        return new FeatureFlag(
            envId: _envId,
            name: key,
            description: string.Empty,
            key: key,
            isEnabled: isEnabled,
            variationType: "boolean",
            variations: variations,
            disabledVariationId: disabledVariationId,
            enabledVariationId: enabledVariationId,
            tags: [],
            currentUserId: Guid.NewGuid()
        );
    }

    [DockerFact]
    public async Task SetPending_Then_Promote_Committed_Read_Returns_Old_Then_New_Value()
    {
        // Arrange: committed flag, IsEnabled = false, CommittedVersion = 1
        const string key = "b4-flag";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        // build the pending value: same flag but IsEnabled = true
        var pendingValue = CreateFlag(key, isEnabled: true);

        // Act 1: stage a pending change (version 2)
        await _sut.SetPendingAsync(_envId, key, pendingValue, version: 2);

        // Assert 1: committed read still returns the OLD value, with no pending leaked
        var afterStage = await _sut.GetCommittedAsync(_envId, key);
        Assert.False(afterStage.IsEnabled);
        Assert.Equal(1, afterStage.CommittedVersion);
        Assert.Null(afterStage.Pending);

        // sanity: the pending change really was persisted (raw read keeps it)
        var raw = await _sut.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(2, raw.Pending!.Version);
        Assert.True(raw.Pending.Value.IsEnabled);

        // Act 2: promote pending -> committed (guarded on the staged version 2)
        var promoted = await _sut.PromotePendingAsync(_envId, key, expectedVersion: 2);
        Assert.True(promoted);

        // Assert 2: committed read now returns the NEW value and advanced version
        var afterPromote = await _sut.GetCommittedAsync(_envId, key);
        Assert.True(afterPromote.IsEnabled);
        Assert.Equal(2, afterPromote.CommittedVersion);
        Assert.Null(afterPromote.Pending);

        // pending slot cleared on the stored row too
        var rawAfter = await _sut.GetAsync(_envId, key);
        Assert.Null(rawAfter.Pending);
    }

    [DockerFact]
    public async Task GetCommitted_With_No_Pending_Returns_Committed_Value()
    {
        const string key = "b4-no-pending";
        var committed = CreateFlag(key, isEnabled: true);
        committed.CommittedVersion = 5;
        await _sut.AddOneAsync(committed);

        var read = await _sut.GetCommittedAsync(_envId, key);

        Assert.True(read.IsEnabled);
        Assert.Equal(5, read.CommittedVersion);
        Assert.Null(read.Pending);
    }

    [DockerFact]
    public async Task PromotePending_Is_NoOp_When_No_Pending()
    {
        const string key = "b4-promote-noop";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 3;
        await _sut.AddOneAsync(committed);

        var promoted = await _sut.PromotePendingAsync(_envId, key, expectedVersion: 4);
        Assert.False(promoted);

        var read = await _sut.GetCommittedAsync(_envId, key);
        Assert.False(read.IsEnabled);
        Assert.Equal(3, read.CommittedVersion);
        Assert.Null(read.Pending);
    }

    [DockerFact]
    public async Task PromotePending_Is_NoOp_When_Version_Mismatch()
    {
        // a stale coordinator (expecting v2) must NOT clobber a newer staged pending (v3) — #33
        const string key = "b4-promote-version-mismatch";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        var pendingValue = CreateFlag(key, isEnabled: true);
        await _sut.SetPendingAsync(_envId, key, pendingValue, version: 3);

        var promoted = await _sut.PromotePendingAsync(_envId, key, expectedVersion: 2);
        Assert.False(promoted);

        var read = await _sut.GetCommittedAsync(_envId, key);
        Assert.False(read.IsEnabled);
        Assert.Equal(1, read.CommittedVersion);

        var raw = await _sut.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(3, raw.Pending!.Version);
    }

    [DockerFact]
    public async Task SetPending_Stale_Version_Does_Not_Clobber_Newer_Pending()
    {
        // #34: stage v3, then a stale v2 stage must NOT overwrite the newer pending.
        const string key = "b4-setpending-stale";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        await _sut.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: true), version: 3);
        await _sut.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: false), version: 2);

        var raw = await _sut.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(3, raw.Pending!.Version);
        Assert.True(raw.Pending.Value.IsEnabled);
    }

    [DockerFact]
    public async Task SetPending_Not_Written_When_Version_Not_Above_Committed()
    {
        // #34: committed is already v2; staging v2 (or lower) must write no pending.
        const string key = "b4-setpending-not-above-committed";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 2;
        await _sut.AddOneAsync(committed);

        await _sut.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: true), version: 2);

        var raw = await _sut.GetAsync(_envId, key);
        Assert.Null(raw.Pending);
    }

    [DockerFact]
    public async Task SetPending_Newer_Version_Overwrites_Older_Pending()
    {
        // #34: staging v4 over an existing pending v3 must advance the pending to v4.
        const string key = "b4-setpending-newer";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        await _sut.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: false), version: 3);
        await _sut.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: true), version: 4);

        var raw = await _sut.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(4, raw.Pending!.Version);
        Assert.True(raw.Pending.Value.IsEnabled);
    }

    [DockerFact]
    public async Task Promote_Refreshes_Audit_Fields_On_Committed_Value()
    {
        // #35: promotion must refresh the committed value's audit fields so UpdatedAt reflects WHEN
        // it became authoritative and UpdatorId reflects WHO authored the pending change.
        const string key = "b4-promote-audit";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        var staleTime = DateTime.UtcNow.AddDays(-7);
        committed.UpdatedAt = staleTime;
        committed.UpdatorId = Guid.NewGuid();
        await _sut.AddOneAsync(committed);

        var pendingAuthor = Guid.NewGuid();
        var pendingValue = CreateFlag(key, isEnabled: true);
        pendingValue.UpdatorId = pendingAuthor;
        await _sut.SetPendingAsync(_envId, key, pendingValue, version: 2);

        var promoted = await _sut.PromotePendingAsync(_envId, key, expectedVersion: 2);
        Assert.True(promoted);

        var afterPromote = await _sut.GetCommittedAsync(_envId, key);
        Assert.True(afterPromote.UpdatedAt > staleTime);
        Assert.Equal(pendingAuthor, afterPromote.UpdatorId);
    }

    [DockerFact]
    public async Task SetPending_Strips_Nested_Pending_From_Staged_Value()
    {
        // #35: a pending value must never itself carry a (nested) pending change.
        const string key = "b4-no-nested-pending";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        var pendingValue = CreateFlag(key, isEnabled: true);
        pendingValue.SetPending(CreateFlag(key, isEnabled: false), version: 99);
        Assert.NotNull(pendingValue.Pending);

        await _sut.SetPendingAsync(_envId, key, pendingValue, version: 2);

        var raw = await _sut.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Null(raw.Pending!.Value.Pending);
    }
}
