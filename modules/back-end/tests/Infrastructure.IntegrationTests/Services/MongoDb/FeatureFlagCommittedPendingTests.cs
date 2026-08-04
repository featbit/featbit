using Domain.FeatureFlags;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

/// <summary>
/// B3 acceptance: the authoritative committed read must return the COMMITTED flag value,
/// never a pending (staged-but-not-committed) change.
///
/// Integration test against the shared MongoDB Testcontainers fixture. Uses a UNIQUE throwaway database that
/// is dropped on dispose.
/// </summary>
[Collection(MongoCollection.Name)]
public sealed class FeatureFlagCommittedPendingTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _fixture;

    public FeatureFlagCommittedPendingTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }


    private readonly string _dbName = $"featbit_b3_test_{Guid.NewGuid():N}";
    private MongoDbClient _mongoDb = null!;
    private FeatureFlagService _sut = null!;
    private readonly Guid _envId = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        var options = Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = _dbName
        });

        _mongoDb = new MongoDbClient(options);

        // fail fast / readable skip if Mongo is not available
        await _mongoDb.Database.RunCommandAsync<MongoDB.Bson.BsonDocument>(
            new MongoDB.Bson.BsonDocument("ping", 1)
        );

        _sut = new FeatureFlagService(_mongoDb);
    }

    public async Task DisposeAsync()
    {
        // drop the throwaway database
        await _mongoDb.Database.Client.DropDatabaseAsync(_dbName);
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
        const string key = "b3-flag";
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

        // pending slot cleared on the stored document too
        var rawAfter = await _sut.GetAsync(_envId, key);
        Assert.Null(rawAfter.Pending);
    }

    [DockerFact]
    public async Task GetCommitted_With_No_Pending_Returns_Committed_Value()
    {
        const string key = "b3-no-pending";
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
        const string key = "b3-promote-noop";
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
        const string key = "b3-promote-version-mismatch";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        var pendingValue = CreateFlag(key, isEnabled: true);
        await _sut.SetPendingAsync(_envId, key, pendingValue, version: 3);

        // coordinator tries to promote expecting the older version 2 -> guard rejects it
        var promoted = await _sut.PromotePendingAsync(_envId, key, expectedVersion: 2);
        Assert.False(promoted);

        // committed value untouched and the v3 pending is still intact
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
        const string key = "b3-setpending-stale";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        // newer pending (v3) carries IsEnabled = true
        await _sut.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: true), version: 3);

        // stale out-of-order stage (v2) carries IsEnabled = false -> must be a no-op
        await _sut.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: false), version: 2);

        // pending stays v3 with the newer value intact
        var raw = await _sut.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(3, raw.Pending!.Version);
        Assert.True(raw.Pending.Value.IsEnabled);
    }

    [DockerFact]
    public async Task SetPending_Not_Written_When_Version_Not_Above_Committed()
    {
        // #34: committed is already v2; staging v2 (or lower) must write no pending.
        const string key = "b3-setpending-not-above-committed";
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
        const string key = "b3-setpending-newer";
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
        const string key = "b3-promote-audit";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        // force a clearly-stale committed timestamp/author so the refresh is observable
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
        const string key = "b3-no-nested-pending";
        var committed = CreateFlag(key, isEnabled: false);
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        var pendingValue = CreateFlag(key, isEnabled: true);
        // attach a bogus nested pending that must be stripped on stage
        pendingValue.SetPending(CreateFlag(key, isEnabled: false), version: 99);
        Assert.NotNull(pendingValue.Pending);

        await _sut.SetPendingAsync(_envId, key, pendingValue, version: 2);

        var raw = await _sut.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Null(raw.Pending!.Value.Pending);
    }
}
