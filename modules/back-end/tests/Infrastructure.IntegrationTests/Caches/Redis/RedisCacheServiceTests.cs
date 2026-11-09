using System.Text.Json;
using Application.Caches;
using Application.ControlPlane;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Segments;
using Domain.Workspaces;
using Infrastructure.Caches.Redis;
using Infrastructure.IntegrationTests.Fixtures;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.IntegrationTests.Caches.Redis;

[Collection(RedisCollection.Name)]
public class RedisCacheServiceTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;
    private ConnectionMultiplexer _connection = null!;
    private RedisCacheService _sut = null!;

    public RedisCacheServiceTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    /// <summary>
    /// Connects to the shared Redis container with admin access, clears it, and builds the service under test.
    /// </summary>
    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        var options = ConfigurationOptions.Parse(_fixture.ConnectionString);
        options.AllowAdmin = true;
        _connection = await ConnectionMultiplexer.ConnectAsync(options);

        var server = _connection.GetServer(_connection.GetEndPoints().Single());
        await server.FlushDatabaseAsync();

        var clientMock = new Mock<IRedisClient>();
        clientMock.Setup(x => x.GetDatabase()).Returns(() => _connection.GetDatabase());
        clientMock.Setup(x => x.Connection).Returns(_connection);

        _sut = new RedisCacheService(clientMock.Object);
    }

    public Task DisposeAsync()
    {
        _connection?.Dispose();
        return Task.CompletedTask;
    }

    [DockerFact]
    public async Task UpsertFlagAsync_WritesCacheAndIndex()
    {
        var flag = NewFlag();

        await _sut.UpsertFlagAsync(flag);

        var db = _connection.GetDatabase();
        Assert.True(await db.KeyExistsAsync(RedisKeys.Flag(flag.Id)));
        var indexScore = await db.SortedSetScoreAsync(RedisKeys.FlagIndex(flag.EnvId), flag.Id.ToString());
        Assert.Equal(new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds(), indexScore);
    }

    [DockerFact]
    public async Task UpsertFlagAsync_OverwritesExistingCache()
    {
        var flag = NewFlag();
        await _sut.UpsertFlagAsync(flag);

        flag.Name = "renamed";
        flag.UpdatedAt = flag.UpdatedAt.AddSeconds(60);
        await _sut.UpsertFlagAsync(flag);

        var bytes = (byte[]?)await _connection.GetDatabase().StringGetAsync(RedisKeys.Flag(flag.Id));
        var roundTripped = JsonSerializer.Deserialize<FeatureFlag>(bytes!,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal("renamed", roundTripped!.Name);
    }

    [DockerFact]
    public async Task DeleteFlagAsync_RemovesCacheAndIndex()
    {
        var flag = NewFlag();
        await _sut.UpsertFlagAsync(flag);

        await _sut.DeleteFlagAsync(flag.EnvId, flag.Id);

        var db = _connection.GetDatabase();
        Assert.False(await db.KeyExistsAsync(RedisKeys.Flag(flag.Id)));
        Assert.Null(await db.SortedSetScoreAsync(RedisKeys.FlagIndex(flag.EnvId), flag.Id.ToString()));
    }

    [DockerFact]
    public async Task DeleteFlagAsync_CommittedVersionExists_RemovesTheVersionAndKeepsThePointer()
    {
        var flag = NewFlag();
        const long ts = 1000;
        await _sut.StageFlagAsync(flag, ts);
        await _sut.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), ts);

        await _sut.DeleteFlagAsync(flag.EnvId, flag.Id);

        var db = _connection.GetDatabase();
        Assert.False(await db.KeyExistsAsync(RedisKeys.FlagVersion(flag.Id, ts)));
        Assert.True(await db.KeyExistsAsync(RedisKeys.FlagCommittedPointer(flag.Id)));
        Assert.Null(await db.SortedSetScoreAsync(RedisKeys.FlagIndex(flag.EnvId), flag.Id.ToString()));
    }

    [DockerFact]
    public async Task DeleteFlagAsync_CommittedVersionExists_LeavesAnotherFlagsStateAlone()
    {
        var flag = NewFlag();
        flag.Id = Guid.NewGuid();
        var other = NewFlag(flag.EnvId);
        other.Id = Guid.NewGuid();
        const long ts = 1000;
        await _sut.StageFlagAsync(flag, ts);
        await _sut.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), ts);
        await _sut.StageFlagAsync(other, ts);
        await _sut.CommitFlagAsync(other.EnvId, other.Id.ToString(), ts);

        await _sut.DeleteFlagAsync(flag.EnvId, flag.Id);

        var db = _connection.GetDatabase();
        Assert.True(await db.KeyExistsAsync(RedisKeys.FlagVersion(other.Id, ts)));
        Assert.True(await db.KeyExistsAsync(RedisKeys.FlagCommittedPointer(other.Id)));
        Assert.NotNull(await db.SortedSetScoreAsync(RedisKeys.FlagIndex(other.EnvId), other.Id.ToString()));
    }

    /// <summary>
    /// A backfill that read the database before the flag was archived and deleted commits its older version after the
    /// delete. The flag is served only when the committed pointer resolves to an existing version, so it must not be.
    /// </summary>
    [DockerFact]
    public async Task DeleteFlagAsync_AStaleCommitArrivesAfterTheDelete_DoesNotMakeTheFlagServableAgain()
    {
        var flag = NewFlag();
        flag.Id = Guid.NewGuid();
        const long staleTs = 1000;
        const long archivedTs = 2000;
        await _sut.StageFlagAsync(flag, staleTs);
        await _sut.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), staleTs);
        await _sut.StageFlagAsync(flag, archivedTs);
        await _sut.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), archivedTs);
        await _sut.DeleteFlagAsync(flag.EnvId, flag.Id);

        await _sut.StageFlagAsync(flag, staleTs);
        await _sut.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), staleTs);

        var db = _connection.GetDatabase();
        var pointer = await db.StringGetAsync(RedisKeys.FlagCommittedPointer(flag.Id));
        var servable = pointer.HasValue && await db.KeyExistsAsync(RedisKeys.FlagVersion(flag.Id, (long)pointer));
        Assert.False(servable);
    }

    /// <summary>
    /// Segment counterpart of the stale-commit test for flags.
    /// </summary>
    [DockerFact]
    public async Task DeleteSegmentAsync_AStaleCommitArrivesAfterTheDelete_DoesNotMakeTheSegmentServableAgain()
    {
        var envIds = new[] { Guid.NewGuid() };
        var segment = NewSegment();
        segment.Id = Guid.NewGuid();
        const long staleTs = 1000;
        const long archivedTs = 2000;
        await _sut.StageSegmentAsync(segment, staleTs);
        await _sut.CommitSegmentAsync(envIds, segment.Id.ToString(), staleTs);
        await _sut.StageSegmentAsync(segment, archivedTs);
        await _sut.CommitSegmentAsync(envIds, segment.Id.ToString(), archivedTs);
        await _sut.DeleteSegmentAsync(envIds, segment.Id);

        await _sut.StageSegmentAsync(segment, staleTs);
        await _sut.CommitSegmentAsync(envIds, segment.Id.ToString(), staleTs);

        var db = _connection.GetDatabase();
        var pointer = await db.StringGetAsync(RedisKeys.SegmentCommittedPointer(segment.Id));
        var servable = pointer.HasValue && await db.KeyExistsAsync(RedisKeys.SegmentVersion(segment.Id, (long)pointer));
        Assert.False(servable);
    }

    [DockerFact]
    public async Task DeleteFlagAsync_PointerIsNotANumber_LeavesThePointerAlone()
    {
        var flag = NewFlag();
        var db = _connection.GetDatabase();
        await db.StringSetAsync(RedisKeys.FlagCommittedPointer(flag.Id), "not-a-timestamp");

        await _sut.DeleteFlagAsync(flag.EnvId, flag.Id);

        Assert.Equal("not-a-timestamp", await db.StringGetAsync(RedisKeys.FlagCommittedPointer(flag.Id)));
    }

    [DockerFact]
    public async Task UpsertSegmentAsync_WritesIndexForEachEnvironment()
    {
        var envIds = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        var segment = NewSegment();

        await _sut.UpsertSegmentAsync(envIds, segment);

        var db = _connection.GetDatabase();
        Assert.True(await db.KeyExistsAsync(RedisKeys.Segment(segment.Id)));
        foreach (var envId in envIds)
        {
            var score = await db.SortedSetScoreAsync(RedisKeys.SegmentIndex(envId), segment.Id.ToString());
            Assert.NotNull(score);
        }
    }

    [DockerFact]
    public async Task DeleteSegmentAsync_RemovesIndexFromEachEnvironment()
    {
        var envIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var segment = NewSegment();
        await _sut.UpsertSegmentAsync(envIds, segment);

        await _sut.DeleteSegmentAsync(envIds, segment.Id);

        var db = _connection.GetDatabase();
        Assert.False(await db.KeyExistsAsync(RedisKeys.Segment(segment.Id)));
        foreach (var envId in envIds)
        {
            Assert.Null(await db.SortedSetScoreAsync(RedisKeys.SegmentIndex(envId), segment.Id.ToString()));
        }
    }

    /// <summary>
    /// Deleting a segment that belongs to two environments removes its committed version and its index entries, and keeps
    /// the committed pointer.
    /// </summary>
    [DockerFact]
    public async Task DeleteSegmentAsync_CommittedVersionExists_RemovesTheVersionAndKeepsThePointer()
    {
        var envIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var segment = NewSegment();
        const long ts = 1000;
        await _sut.StageSegmentAsync(segment, ts);
        await _sut.CommitSegmentAsync(envIds, segment.Id.ToString(), ts);

        await _sut.DeleteSegmentAsync(envIds, segment.Id);

        var db = _connection.GetDatabase();
        Assert.False(await db.KeyExistsAsync(RedisKeys.SegmentVersion(segment.Id, ts)));
        Assert.True(await db.KeyExistsAsync(RedisKeys.SegmentCommittedPointer(segment.Id)));
        foreach (var envId in envIds)
        {
            Assert.Null(await db.SortedSetScoreAsync(RedisKeys.SegmentIndex(envId), segment.Id.ToString()));
        }
    }

    [DockerFact]
    public async Task UpsertLicenseAsync_StoresLicenseStringAtWorkspaceKey()
    {
        var workspace = new Workspace { Id = Guid.NewGuid(), Name = "ws", Key = "ws", License = "license-payload" };

        await _sut.UpsertLicenseAsync(workspace);

        var stored = await _connection.GetDatabase().StringGetAsync(RedisKeys.License(workspace.Id));
        Assert.Equal("license-payload", stored);
    }

    [DockerFact]
    public async Task GetOrSetLicenseAsync_KeyMissing_InvokesGetterAndStoresResult()
    {
        var workspaceId = Guid.NewGuid();
        var calls = 0;

        var license = await _sut.GetOrSetLicenseAsync(workspaceId, () =>
        {
            calls++;
            return Task.FromResult("fresh-license");
        });

        Assert.Equal("fresh-license", license);
        Assert.Equal(1, calls);
        Assert.Equal("fresh-license", (string?)await _connection.GetDatabase().StringGetAsync(RedisKeys.License(workspaceId)));
    }

    [DockerFact]
    public async Task GetOrSetLicenseAsync_KeyExists_ReturnsCachedAndDoesNotInvokeGetter()
    {
        var workspaceId = Guid.NewGuid();
        await _connection.GetDatabase().StringSetAsync(RedisKeys.License(workspaceId), "cached-license");
        var calls = 0;

        var license = await _sut.GetOrSetLicenseAsync(workspaceId, () =>
        {
            calls++;
            return Task.FromResult("should-not-be-called");
        });

        Assert.Equal("cached-license", license);
        Assert.Equal(0, calls);
    }

    [DockerFact]
    public async Task UpsertSecretAsync_StoresHashWithOrgProjectEnvFields()
    {
        var resource = new ResourceDescriptor
        {
            Organization = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "Org", Key = "org" },
            Project = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "Proj", Key = "proj" },
            Environment = new IdNameKeyProps { Id = Guid.NewGuid(), Name = "Env", Key = "env" }
        };
        var secret = new Secret(resource.Environment.Id, "primary", SecretTypes.Server);

        await _sut.UpsertSecretAsync(resource, secret);

        var entries = await _connection.GetDatabase().HashGetAllAsync(RedisKeys.Secret(secret.Value));
        var asMap = entries.ToDictionary(x => x.Name.ToString(), x => x.Value.ToString());

        Assert.Equal(SecretTypes.Server, asMap["type"]);
        Assert.Equal(resource.Organization.Id.ToString(), asMap["organizationId"]);
        Assert.Equal(resource.Project.Key, asMap["projectKey"]);
        Assert.Equal(resource.Environment.Id.ToString(), asMap["envId"]);
        Assert.Equal(resource.Environment.Key, asMap["envKey"]);
    }

    [DockerFact]
    public async Task DeleteSecretAsync_RemovesKey()
    {
        var secret = new Secret(Guid.NewGuid(), "delete-me", SecretTypes.Server);
        await _connection.GetDatabase().HashSetAsync(RedisKeys.Secret(secret.Value),
            [new HashEntry("type", SecretTypes.Server)]);

        await _sut.DeleteSecretAsync(secret);

        Assert.False(await _connection.GetDatabase().KeyExistsAsync(RedisKeys.Secret(secret.Value)));
    }

    /// <summary>
    /// Seeds more connection keys than one cleanup batch, interleaved between two pods, and checks that only the dead pod's
    /// keys and heartbeat entry go while the other pod's keys and unrelated keys stay.
    /// </summary>
    [DockerFact]
    public async Task DeletePodConnection_ManyConnectionKeys_RemovesOnlyTheKeysOwnedByThePod()
    {
        var podA = Guid.NewGuid();
        var podB = Guid.NewGuid();
        var db = _connection.GetDatabase();

        // More keys than one cleanup batch, interleaved so that every batch holds both pods' keys.
        const int total = 1203;
        var ownedByA = 0;
        for (var i = 0; i < total; i++)
        {
            var owner = i % 2 == 0 ? podA : podB;
            ownedByA += owner == podA ? 1 : 0;
            await SeedConnectionAsync($"c{i}", owner.ToString());
        }

        await db.HashSetAsync(RedisKeys.Heartbeats, podA.ToString(), "{}");
        await db.HashSetAsync(RedisKeys.Heartbeats, podB.ToString(), "{}");
        await db.StringSetAsync("featbit:flag:unrelated", "keep");

        await _sut.DeletePodConnection(podA);

        var remaining = _connection.GetServer(_connection.GetEndPoints().Single())
            .Keys(pattern: RedisKeys.ConnectionPattern)
            .ToArray();
        Assert.Equal(total - ownedByA, remaining.Length);
        foreach (var key in remaining)
        {
            Assert.Equal(podB.ToString(), (string?)await db.HashGetAsync(key, "heartbeatId"));
        }

        Assert.False(await db.HashExistsAsync(RedisKeys.Heartbeats, podA.ToString()));
        Assert.True(await db.HashExistsAsync(RedisKeys.Heartbeats, podB.ToString()));
        Assert.Equal("keep", await db.StringGetAsync("featbit:flag:unrelated"));
    }

    [DockerFact]
    public async Task DeletePodConnection_NoConnectionKeys_DeletesTheHeartbeatEntryOnly()
    {
        var pod = Guid.NewGuid();
        var db = _connection.GetDatabase();
        await db.HashSetAsync(RedisKeys.Heartbeats, pod.ToString(), "{}");
        await db.StringSetAsync("featbit:flag:unrelated", "keep");

        await _sut.DeletePodConnection(pod);

        Assert.False(await db.HashExistsAsync(RedisKeys.Heartbeats, pod.ToString()));
        Assert.Equal("keep", await db.StringGetAsync("featbit:flag:unrelated"));
    }

    [DockerFact]
    public async Task DeletePodConnection_ConnectionKeyWithoutHeartbeatId_KeepsTheKey()
    {
        var pod = Guid.NewGuid();
        await SeedConnectionAsync("no-owner", heartbeatId: null);
        await SeedConnectionAsync("owned", pod.ToString());

        await _sut.DeletePodConnection(pod);

        var db = _connection.GetDatabase();
        Assert.True(await db.KeyExistsAsync(RedisKeys.Connection("no-owner")));
        Assert.False(await db.KeyExistsAsync(RedisKeys.Connection("owned")));
    }

    [DockerFact]
    public async Task DeletePodConnection_CleanupFails_KeepsTheHeartbeatEntryForTheNextCheck()
    {
        var pod = Guid.NewGuid();
        var db = _connection.GetDatabase();
        await db.HashSetAsync(RedisKeys.Heartbeats, pod.ToString(), "{}");

        var failingClient = new Mock<IRedisClient>();
        failingClient.Setup(x => x.GetDatabase()).Returns(db);
        failingClient.Setup(x => x.Connection).Throws(new InvalidOperationException("scan failed"));
        var sut = new RedisCacheService(failingClient.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.DeletePodConnection(pod));

        Assert.True(await db.HashExistsAsync(RedisKeys.Heartbeats, pod.ToString()));
    }

    /// <summary>
    /// Writes a connection key as the control plane does, with a heartbeat id only when one is given.
    /// </summary>
    private async Task SeedConnectionAsync(string id, string? heartbeatId)
    {
        var fields = new List<HashEntry> { new("id", id), new("envId", Guid.NewGuid().ToString()), new("secret", "test") };
        if (heartbeatId is not null)
        {
            fields.Add(new HashEntry("heartbeatId", heartbeatId));
        }

        await _connection.GetDatabase().HashSetAsync(RedisKeys.Connection(id), fields.ToArray());
    }

    [DockerFact]
    public async Task GetFlagIndexAsync_FlagsListed_ReturnsEachIdWithItsScore()
    {
        var first = NewFlag();
        first.Id = Guid.NewGuid();
        var second = NewFlag(first.EnvId);
        second.Id = Guid.NewGuid();
        await _sut.UpsertFlagAsync(first);
        await _sut.UpsertFlagAsync(second);

        var index = await _sut.GetFlagIndexAsync(first.EnvId);

        var db = _connection.GetDatabase();
        Assert.Equal(2, index.Count);
        Assert.Equal(
            (long)(await db.SortedSetScoreAsync(RedisKeys.FlagIndex(first.EnvId), first.Id.ToString()))!.Value,
            index[first.Id]);
        Assert.True(index.ContainsKey(second.Id));
    }

    [DockerFact]
    public async Task GetFlagIndexAsync_NothingListed_ReturnsEmpty()
    {
        var index = await _sut.GetFlagIndexAsync(Guid.NewGuid());

        Assert.Empty(index);
    }

    /// <summary>
    /// A segment that belongs to two environments is listed in the index of each.
    /// </summary>
    [DockerFact]
    public async Task GetSegmentIndexAsync_SegmentListedInTwoEnvironments_ReturnsItForEach()
    {
        var envIds = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var segment = NewSegment();
        segment.Id = Guid.NewGuid();
        await _sut.UpsertSegmentAsync(envIds, segment);

        foreach (var envId in envIds)
        {
            Assert.True((await _sut.GetSegmentIndexAsync(envId)).ContainsKey(segment.Id));
        }
    }

    [DockerFact]
    public async Task IsFlagArchivedAsync_ArchivedFlagIsCached_ReturnsTrue()
    {
        var flag = NewFlag();
        flag.Id = Guid.NewGuid();
        flag.IsArchived = true;
        await _sut.UpsertFlagAsync(flag);

        Assert.True(await _sut.IsFlagArchivedAsync(flag.Id, ConsistencyMode.BestEffort));
    }

    [DockerFact]
    public async Task IsFlagArchivedAsync_FlagIsNotArchived_ReturnsFalse()
    {
        var flag = NewFlag();
        flag.Id = Guid.NewGuid();
        await _sut.UpsertFlagAsync(flag);

        Assert.False(await _sut.IsFlagArchivedAsync(flag.Id, ConsistencyMode.BestEffort));
    }

    [DockerFact]
    public async Task IsFlagArchivedAsync_NoValueIsCached_ReturnsFalse()
    {
        Assert.False(await _sut.IsFlagArchivedAsync(Guid.NewGuid(), ConsistencyMode.BestEffort));
    }

    [DockerFact]
    public async Task IsFlagArchivedAsync_ValueCannotBeRead_ReturnsFalse()
    {
        var id = Guid.NewGuid();
        await _connection.GetDatabase().StringSetAsync(RedisKeys.Flag(id), "not json");

        Assert.False(await _sut.IsFlagArchivedAsync(id, ConsistencyMode.BestEffort));
    }

    [DockerFact]
    public async Task IsFlagArchivedAsync_ArchivedFlagIsCommittedUnderGatedCommit_ReturnsTrue()
    {
        var flag = NewFlag();
        flag.Id = Guid.NewGuid();
        flag.IsArchived = true;
        const long ts = 1000;
        await _sut.StageFlagAsync(flag, ts);
        await _sut.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), ts);

        Assert.True(await _sut.IsFlagArchivedAsync(flag.Id, ConsistencyMode.GatedCommit));
    }

    [DockerFact]
    public async Task IsFlagArchivedAsync_RolledBackToBestEffort_ReadsThePlainValueNotTheStalePointer()
    {
        // A flag committed under GatedCommit, then archived after the switch back to BestEffort: the pointer
        // still refers to the old, unarchived version while the plain value is current.
        var flag = NewFlag();
        flag.Id = Guid.NewGuid();
        const long ts = 1000;
        await _sut.StageFlagAsync(flag, ts);
        await _sut.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), ts);
        flag.IsArchived = true;
        await _sut.UpsertFlagAsync(flag);

        Assert.True(await _sut.IsFlagArchivedAsync(flag.Id, ConsistencyMode.BestEffort));
        Assert.False(await _sut.IsFlagArchivedAsync(flag.Id, ConsistencyMode.GatedCommit));
    }

    [DockerFact]
    public async Task IsFlagArchivedAsync_GatedCommitButNoPointer_FallsBackToThePlainValue()
    {
        var flag = NewFlag();
        flag.Id = Guid.NewGuid();
        flag.IsArchived = true;
        await _sut.UpsertFlagAsync(flag);

        Assert.True(await _sut.IsFlagArchivedAsync(flag.Id, ConsistencyMode.GatedCommit));
    }

    [DockerFact]
    public async Task IsSegmentArchivedAsync_RolledBackToBestEffort_ReadsThePlainValueNotTheStalePointer()
    {
        var envIds = new[] { Guid.NewGuid() };
        var segment = NewSegment();
        segment.Id = Guid.NewGuid();
        const long ts = 1000;
        await _sut.StageSegmentAsync(segment, ts);
        await _sut.CommitSegmentAsync(envIds, segment.Id.ToString(), ts);
        segment.IsArchived = true;
        await _sut.UpsertSegmentAsync(envIds, segment);

        Assert.True(await _sut.IsSegmentArchivedAsync(segment.Id, ConsistencyMode.BestEffort));
        Assert.False(await _sut.IsSegmentArchivedAsync(segment.Id, ConsistencyMode.GatedCommit));
    }

    [DockerFact]
    public async Task IsSegmentArchivedAsync_ArchivedSegmentIsCached_ReturnsTrue()
    {
        var segment = NewSegment();
        segment.Id = Guid.NewGuid();
        segment.IsArchived = true;
        await _sut.UpsertSegmentAsync([Guid.NewGuid()], segment);

        Assert.True(await _sut.IsSegmentArchivedAsync(segment.Id, ConsistencyMode.BestEffort));
    }

    [DockerFact]
    public async Task IsSegmentArchivedAsync_SegmentIsNotArchived_ReturnsFalse()
    {
        var segment = NewSegment();
        segment.Id = Guid.NewGuid();
        await _sut.UpsertSegmentAsync([Guid.NewGuid()], segment);

        Assert.False(await _sut.IsSegmentArchivedAsync(segment.Id, ConsistencyMode.BestEffort));
    }

    private static FeatureFlag NewFlag(Guid? envId = null)
    {
        var flag = new FeatureFlag(
            envId: envId ?? Guid.NewGuid(),
            name: "test-flag",
            description: "desc",
            key: "test-flag",
            isEnabled: true,
            variationType: "boolean",
            variations:
            [
                new Variation { Id = "v1", Name = "true", Value = "true" },
                new Variation { Id = "v2", Name = "false", Value = "false" }
            ],
            disabledVariationId: "v2",
            enabledVariationId: "v1",
            tags: [],
            currentUserId: Guid.NewGuid());
        return flag;
    }

    private static Segment NewSegment(Guid? workspaceId = null, Guid? envId = null)
    {
        return new Segment(
            workspaceId: workspaceId ?? Guid.NewGuid(),
            envId: envId ?? Guid.NewGuid(),
            name: "test-segment",
            key: "test-segment",
            type: SegmentType.EnvironmentSpecific,
            scopes: [],
            included: [],
            excluded: [],
            rules: [],
            description: "");
    }
}
