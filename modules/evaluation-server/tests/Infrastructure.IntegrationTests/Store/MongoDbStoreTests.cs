using System.Text;
using System.Text.Json;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Store;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Store;

[Collection(MongoCollection.Name)]
public class MongoDbStoreTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _fixture;
    private IMongoDatabase _db = null!;
    private MongoDbStore _sut = null!;
    private string _dbName = string.Empty;

    public MongoDbStoreTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        _dbName = $"ft-tests-{Guid.NewGuid():N}";

        var options = Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = _dbName
        });

        var client = new MongoDbClient(options);
        _db = client.Database;
        _sut = new MongoDbStore(client);

        await Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        if (!DockerAvailability.IsAvailable || string.IsNullOrEmpty(_dbName))
        {
            return;
        }

        await new MongoClient(_fixture.ConnectionString).DropDatabaseAsync(_dbName);
    }

    [DockerFact]
    public async Task IsAvailableAsync_HealthyContainer_ReturnsTrue()
    {
        var available = await _sut.IsAvailableAsync();

        Assert.True(available);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByEnvAndTimestamp_ReturnsOnlyFlagsNewerThanTimestamp()
    {
        var envId = Guid.NewGuid();
        await InsertFlagAsync(envId, "old", DateTime.UnixEpoch.AddMilliseconds(1000));
        await InsertFlagAsync(envId, "mid", DateTime.UnixEpoch.AddMilliseconds(2000));
        await InsertFlagAsync(envId, "new", DateTime.UnixEpoch.AddMilliseconds(3000));

        var result = (await _sut.GetFlagsAsync(envId, 1500)).Select(DecodeKey).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains("mid", result);
        Assert.Contains("new", result);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByEnvAndTimestamp_DifferentEnv_NotReturned()
    {
        var envId = Guid.NewGuid();
        var otherEnvId = Guid.NewGuid();

        await InsertFlagAsync(envId, "mine", DateTime.UnixEpoch.AddMilliseconds(2000));
        await InsertFlagAsync(otherEnvId, "theirs", DateTime.UnixEpoch.AddMilliseconds(2000));

        var result = (await _sut.GetFlagsAsync(envId, 0)).Select(DecodeKey).ToList();

        Assert.Single(result);
        Assert.Contains("mine", result);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByIds_ReturnsRequestedFlagsOnly()
    {
        var envId = Guid.NewGuid();
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        var id3 = Guid.NewGuid();

        await InsertFlagAsync(envId, "a", DateTime.UtcNow, id1);
        await InsertFlagAsync(envId, "b", DateTime.UtcNow, id2);
        await InsertFlagAsync(envId, "c", DateTime.UtcNow, id3);

        var result = (await _sut.GetFlagsAsync([id1.ToString(), id3.ToString()])).Select(DecodeKey).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains("a", result);
        Assert.Contains("c", result);
    }

    [DockerFact]
    public async Task GetSegmentAsync_KnownId_ReturnsBytes()
    {
        var id = Guid.NewGuid();
        await _db.GetCollection<BsonDocument>("Segments").InsertOneAsync(new BsonDocument
        {
            { "_id", new BsonBinaryData(id, GuidRepresentation.Standard) },
            { "name", "finance" }
        });

        var bytes = await _sut.GetSegmentAsync(id.ToString());

        var json = JsonSerializer.Deserialize<JsonElement>(Encoding.UTF8.GetString(bytes));
        Assert.Equal("finance", json.GetProperty("name").GetString());
        // _id has been renamed to id by BsonDocumentExtensions.ToJsonBytes.
        Assert.True(json.TryGetProperty("id", out _));
    }

    private Task InsertFlagAsync(Guid envId, string key, DateTime updatedAt, Guid? id = null)
    {
        var doc = new BsonDocument
        {
            { "_id", new BsonBinaryData(id ?? Guid.NewGuid(), GuidRepresentation.Standard) },
            { "envId", new BsonBinaryData(envId, GuidRepresentation.Standard) },
            { "key", key },
            { "updatedAt", updatedAt }
        };
        return _db.GetCollection<BsonDocument>("FeatureFlags").InsertOneAsync(doc);
    }

    private static string DecodeKey(byte[] bytes)
    {
        var json = JsonSerializer.Deserialize<JsonElement>(Encoding.UTF8.GetString(bytes));
        return json.GetProperty("key").GetString()!;
    }
}
