using Domain.AuditLogs;
using Domain.Segments;
using Domain.Targeting;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

/// <summary>
/// S1 acceptance (Mongo): the authoritative committed read must return the COMMITTED segment
/// value, never a pending (staged-but-not-committed) change. After promotion the committed read
/// returns the new value with an advanced CommittedVersion. Promotion is version-guarded.
///
/// Integration test against a real MongoDB instance. Uses a UNIQUE throwaway database that is
/// dropped on dispose. Fails loudly if no Mongo is reachable.
/// </summary>
[Collection(MongoCollection.Name)]
public sealed class SegmentCommittedPendingTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _fixture;

    public SegmentCommittedPendingTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }


    private readonly string _dbName = $"featbit_s1_test_{Guid.NewGuid():N}";
    private MongoDbClient _mongoDb = null!;
    private SegmentService _sut = null!;
    private readonly Guid _workspaceId = Guid.NewGuid();
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

        _sut = new SegmentService(_mongoDb, NullLogger<SegmentService>.Instance);
    }

    public async Task DisposeAsync()
    {
        await _mongoDb.Database.Client.DropDatabaseAsync(_dbName);
    }

    private Segment CreateSegment(string key, string description)
    {
        return new Segment(
            workspaceId: _workspaceId,
            envId: _envId,
            name: key,
            key: key,
            type: SegmentType.EnvironmentSpecific,
            scopes: [],
            included: [],
            excluded: [],
            rules: new List<MatchRule>(),
            description: description
        );
    }

    [DockerFact]
    public async Task SetPending_Then_Promote_Committed_Read_Returns_Old_Then_New_Value()
    {
        // Arrange: committed segment, description "old", CommittedVersion = 1
        var committed = CreateSegment("s1-segment", "old");
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        // build the pending value: same segment but description "new"
        var pendingValue = CreateSegment("s1-segment", "new");

        // Act 1: stage a pending change (version 2)
        await _sut.SetPendingAsync(committed.Id, pendingValue, version: 2);

        // Assert 1: committed read still returns the OLD value, with no pending leaked
        var afterStage = await _sut.GetCommittedAsync(committed.Id);
        Assert.Equal("old", afterStage.Description);
        Assert.Equal(1, afterStage.CommittedVersion);
        Assert.Null(afterStage.Pending);

        // sanity: the pending change really was persisted (raw read keeps it)
        var raw = await _sut.GetAsync(committed.Id);
        Assert.NotNull(raw.Pending);
        Assert.Equal(2, raw.Pending!.Version);
        Assert.Equal("new", raw.Pending.Value.Description);

        // Act 2: promote pending -> committed (guarded on the staged version 2)
        var promoted = await _sut.PromotePendingAsync(committed.Id, expectedVersion: 2);
        Assert.True(promoted);

        // Assert 2: committed read now returns the NEW value and advanced version
        var afterPromote = await _sut.GetCommittedAsync(committed.Id);
        Assert.Equal("new", afterPromote.Description);
        Assert.Equal(2, afterPromote.CommittedVersion);
        Assert.Null(afterPromote.Pending);

        // pending slot cleared on the stored document too
        var rawAfter = await _sut.GetAsync(committed.Id);
        Assert.Null(rawAfter.Pending);
    }

    [DockerFact]
    public async Task SetPending_Persists_Attribution_And_Promote_Still_Clears_Pending()
    {
        // #73a: the attribution context (operator/operation/isTargetingChange) captured at stage
        // time must roundtrip through the store, and promotion must still clear Pending as before.
        var committed = CreateSegment("s1-attribution", "old");
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        var pendingValue = CreateSegment("s1-attribution", "new");
        var operatorId = Guid.NewGuid();
        const string operation = Operations.Archive;
        const bool isTargetingChange = false;

        await _sut.SetPendingAsync(
            committed.Id, pendingValue, version: 2,
            operatorId: operatorId, operation: operation, isTargetingChange: isTargetingChange);

        // the attribution context roundtrips on the raw (staged) read
        var raw = await _sut.GetAsync(committed.Id);
        Assert.NotNull(raw.Pending);
        Assert.Equal(operatorId, raw.Pending!.OperatorId);
        Assert.Equal(operation, raw.Pending.Operation);
        Assert.Equal(isTargetingChange, raw.Pending.IsTargetingChange);

        // promote still clears Pending as before, unaffected by the new attribution fields
        var promoted = await _sut.PromotePendingAsync(committed.Id, expectedVersion: 2);
        Assert.True(promoted);

        var rawAfter = await _sut.GetAsync(committed.Id);
        Assert.Null(rawAfter.Pending);
    }

    [DockerFact]
    public async Task GetCommitted_With_No_Pending_Returns_Committed_Value()
    {
        var committed = CreateSegment("s1-no-pending", "value");
        committed.CommittedVersion = 5;
        await _sut.AddOneAsync(committed);

        var read = await _sut.GetCommittedAsync(committed.Id);

        Assert.Equal("value", read.Description);
        Assert.Equal(5, read.CommittedVersion);
        Assert.Null(read.Pending);
    }

    [DockerFact]
    public async Task PromotePending_Is_NoOp_When_No_Pending()
    {
        var committed = CreateSegment("s1-promote-noop", "old");
        committed.CommittedVersion = 3;
        await _sut.AddOneAsync(committed);

        var promoted = await _sut.PromotePendingAsync(committed.Id, expectedVersion: 4);
        Assert.False(promoted);

        var read = await _sut.GetCommittedAsync(committed.Id);
        Assert.Equal("old", read.Description);
        Assert.Equal(3, read.CommittedVersion);
        Assert.Null(read.Pending);
    }

    [DockerFact]
    public async Task PromotePending_Is_NoOp_When_Version_Mismatch()
    {
        // a stale coordinator (expecting v2) must NOT clobber a newer staged pending (v3) — #33
        var committed = CreateSegment("s1-version-mismatch", "old");
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        var pendingValue = CreateSegment("s1-version-mismatch", "new");
        await _sut.SetPendingAsync(committed.Id, pendingValue, version: 3);

        // coordinator tries to promote expecting the older version 2 -> guard rejects it
        var promoted = await _sut.PromotePendingAsync(committed.Id, expectedVersion: 2);
        Assert.False(promoted);

        // committed value untouched and the v3 pending is still intact
        var read = await _sut.GetCommittedAsync(committed.Id);
        Assert.Equal("old", read.Description);
        Assert.Equal(1, read.CommittedVersion);

        var raw = await _sut.GetAsync(committed.Id);
        Assert.NotNull(raw.Pending);
        Assert.Equal(3, raw.Pending!.Version);
    }

    [DockerFact]
    public async Task SetPending_Stale_Version_Does_Not_Clobber_Newer_Pending()
    {
        // #34: stage v3, then a stale v2 stage must NOT overwrite the newer pending.
        var committed = CreateSegment("s1-setpending-stale", "old");
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        await _sut.SetPendingAsync(committed.Id, CreateSegment("s1-setpending-stale", "v3"), version: 3);
        await _sut.SetPendingAsync(committed.Id, CreateSegment("s1-setpending-stale", "v2"), version: 2);

        var raw = await _sut.GetAsync(committed.Id);
        Assert.NotNull(raw.Pending);
        Assert.Equal(3, raw.Pending!.Version);
        Assert.Equal("v3", raw.Pending.Value.Description);
    }

    [DockerFact]
    public async Task SetPending_Not_Written_When_Version_Not_Above_Committed()
    {
        // #34: committed is already v2; staging v2 (or lower) must write no pending.
        var committed = CreateSegment("s1-setpending-not-above-committed", "old");
        committed.CommittedVersion = 2;
        await _sut.AddOneAsync(committed);

        await _sut.SetPendingAsync(committed.Id, CreateSegment("s1-setpending-not-above-committed", "new"), version: 2);

        var raw = await _sut.GetAsync(committed.Id);
        Assert.Null(raw.Pending);
    }

    [DockerFact]
    public async Task SetPending_Newer_Version_Overwrites_Older_Pending()
    {
        // #34: staging v4 over an existing pending v3 must advance the pending to v4.
        var committed = CreateSegment("s1-setpending-newer", "old");
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        await _sut.SetPendingAsync(committed.Id, CreateSegment("s1-setpending-newer", "v3"), version: 3);
        await _sut.SetPendingAsync(committed.Id, CreateSegment("s1-setpending-newer", "v4"), version: 4);

        var raw = await _sut.GetAsync(committed.Id);
        Assert.NotNull(raw.Pending);
        Assert.Equal(4, raw.Pending!.Version);
        Assert.Equal("v4", raw.Pending.Value.Description);
    }

    [DockerFact]
    public async Task GetPending_Returns_Only_Segments_With_Pending()
    {
        var committedOnly = CreateSegment("s1-committed-only", "x");
        await _sut.AddOneAsync(committedOnly);

        var pendingSeg = CreateSegment("s1-with-pending", "x");
        await _sut.AddOneAsync(pendingSeg);
        await _sut.SetPendingAsync(pendingSeg.Id, CreateSegment("s1-with-pending", "y"), version: 2);

        var pending = await _sut.GetPendingAsync();

        Assert.Single(pending);
        Assert.All(pending, s => Assert.NotNull(s.Pending));
        Assert.Equal("s1-with-pending", pending[0].Key);
    }

    [DockerFact]
    public async Task GetAllCommitted_Returns_All_Segments_With_Pending_Stripped()
    {
        var a = CreateSegment("s1-all-a", "x");
        await _sut.AddOneAsync(a);

        var b = CreateSegment("s1-all-b", "x");
        await _sut.AddOneAsync(b);
        await _sut.SetPendingAsync(b.Id, CreateSegment("s1-all-b", "y"), version: 2);

        var all = await _sut.GetAllCommittedAsync();

        Assert.Equal(2, all.Count);
        Assert.All(all, s => Assert.Null(s.Pending));
    }

    [DockerFact]
    public async Task Promote_Refreshes_UpdatedAt_On_Committed_Value()
    {
        // #35: promotion must refresh the committed value's UpdatedAt so it reflects WHEN the value
        // became authoritative. (Segment is an AuditedEntity with no UpdatorId.)
        var committed = CreateSegment("s1-promote-audit", "old");
        committed.CommittedVersion = 1;
        var staleTime = DateTime.UtcNow.AddDays(-7);
        committed.UpdatedAt = staleTime;
        await _sut.AddOneAsync(committed);

        await _sut.SetPendingAsync(committed.Id, CreateSegment("s1-promote-audit", "new"), version: 2);

        var promoted = await _sut.PromotePendingAsync(committed.Id, expectedVersion: 2);
        Assert.True(promoted);

        var afterPromote = await _sut.GetCommittedAsync(committed.Id);
        Assert.Equal("new", afterPromote.Description);
        Assert.True(afterPromote.UpdatedAt > staleTime);
    }

    [DockerFact]
    public async Task SetPending_Strips_Nested_Pending_From_Staged_Value()
    {
        // #35: a pending value must never itself carry a (nested) pending change.
        var committed = CreateSegment("s1-no-nested-pending", "old");
        committed.CommittedVersion = 1;
        await _sut.AddOneAsync(committed);

        var pendingValue = CreateSegment("s1-no-nested-pending", "new");
        pendingValue.SetPending(CreateSegment("s1-no-nested-pending", "bogus"), version: 99);
        Assert.NotNull(pendingValue.Pending);

        await _sut.SetPendingAsync(committed.Id, pendingValue, version: 2);

        var raw = await _sut.GetAsync(committed.Id);
        Assert.NotNull(raw.Pending);
        Assert.Null(raw.Pending!.Value.Pending);
    }
}
