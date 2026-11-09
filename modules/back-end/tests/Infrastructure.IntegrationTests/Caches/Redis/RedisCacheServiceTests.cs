using System.Text.Json;
using Application.Caches;
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

    private async Task SeedConnectionAsync(string id, string? heartbeatId)
    {
        var fields = new List<HashEntry> { new("id", id), new("envId", Guid.NewGuid().ToString()), new("secret", "test") };
        if (heartbeatId is not null)
        {
            fields.Add(new HashEntry("heartbeatId", heartbeatId));
        }

        await _connection.GetDatabase().HashSetAsync(RedisKeys.Connection(id), fields.ToArray());
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
