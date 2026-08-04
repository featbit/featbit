using Domain.FeatureFlags;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

/// <summary>
/// C3b-1 Part 1 (Mongo): GetPendingAsync enumerates every flag (across all envs) whose
/// Pending != null, and excludes flags with no staged change.
///
/// Integration test against the shared MongoDB Testcontainers fixture. Uses a UNIQUE throwaway database that
/// is dropped on dispose.
/// </summary>
[Collection(MongoCollection.Name)]
public sealed class FeatureFlagGetPendingTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly MongoDbFixture _fixture;

    public FeatureFlagGetPendingTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }


    private readonly string _dbName = $"featbit_c3b1_test_{Guid.NewGuid():N}";
    private MongoDbClient _mongoDb = null!;
    private FeatureFlagService _sut = null!;

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

        // fail fast if Mongo is not available
        await _mongoDb.Database.RunCommandAsync<MongoDB.Bson.BsonDocument>(
            new MongoDB.Bson.BsonDocument("ping", 1)
        );

        _sut = new FeatureFlagService(_mongoDb);
    }

    public async Task DisposeAsync()
    {
        await _mongoDb.Database.Client.DropDatabaseAsync(_dbName);
    }

    private static FeatureFlag CreateFlag(Guid envId, string key, bool isEnabled)
    {
        var enabledVariationId = Guid.NewGuid().ToString();
        var disabledVariationId = Guid.NewGuid().ToString();

        var variations = new List<Variation>
        {
            new() { Id = enabledVariationId, Name = "true", Value = "true" },
            new() { Id = disabledVariationId, Name = "false", Value = "false" }
        };

        return new FeatureFlag(
            envId: envId,
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
    public async Task GetPending_Returns_Only_Flags_With_Pending_Across_All_Envs()
    {
        var envA = Guid.NewGuid();
        var envB = Guid.NewGuid();

        // env A: one committed-only flag + one with a pending change
        var aCommittedOnly = CreateFlag(envA, "a-committed-only", isEnabled: false);
        await _sut.AddOneAsync(aCommittedOnly);

        var aPending = CreateFlag(envA, "a-pending", isEnabled: false);
        await _sut.AddOneAsync(aPending);
        await _sut.SetPendingAsync(envA, "a-pending", CreateFlag(envA, "a-pending", true), version: 2);

        // env B: one with a pending change (proves "across all envs")
        var bPending = CreateFlag(envB, "b-pending", isEnabled: false);
        await _sut.AddOneAsync(bPending);
        await _sut.SetPendingAsync(envB, "b-pending", CreateFlag(envB, "b-pending", true), version: 7);

        var pending = await _sut.GetPendingAsync();

        Assert.Equal(2, pending.Count);
        Assert.All(pending, f => Assert.NotNull(f.Pending));

        var keys = pending.Select(f => f.Key).OrderBy(k => k).ToArray();
        Assert.Equal(new[] { "a-pending", "b-pending" }, keys);
    }

    [DockerFact]
    public async Task GetPending_Returns_Empty_When_No_Flags_Have_Pending()
    {
        var envId = Guid.NewGuid();
        await _sut.AddOneAsync(CreateFlag(envId, "no-pending-1", isEnabled: true));
        await _sut.AddOneAsync(CreateFlag(envId, "no-pending-2", isEnabled: false));

        var pending = await _sut.GetPendingAsync();

        Assert.Empty(pending);
    }
}
