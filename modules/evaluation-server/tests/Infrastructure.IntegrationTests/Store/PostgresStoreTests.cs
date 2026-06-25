using System.Text;
using System.Text.Json;
using Dapper;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Store;
using Npgsql;

namespace Infrastructure.IntegrationTests.Store;

[Collection(FeatBitPostgresCollection.Name)]
public class PostgresStoreTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly FeatBitPostgresFixture _fixture;
    private NpgsqlDataSource _dataSource = null!;
    private PostgresStore _sut = null!;

    public PostgresStoreTests(FeatBitPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        _dataSource = NpgsqlDataSource.Create(_fixture.ConnectionString);
        _sut = new PostgresStore(_dataSource);

        // Reset state — schema persists across tests, rows do not.
        await using var conn = await _dataSource.OpenConnectionAsync();
        await conn.ExecuteAsync("TRUNCATE feature_flags, segments, environments, projects, organizations RESTART IDENTITY CASCADE;");
    }

    public Task DisposeAsync()
    {
        _dataSource?.Dispose();
        return Task.CompletedTask;
    }

    [DockerFact]
    public async Task IsAvailableAsync_HealthyContainer_ReturnsTrue()
    {
        var available = await _sut.IsAvailableAsync();

        Assert.True(available);
    }

    [DockerFact]
    public async Task IsAvailableAsync_DisposedDataSource_ReturnsFalse()
    {
        var disposed = NpgsqlDataSource.Create(_fixture.ConnectionString);
        disposed.Dispose();
        var sut = new PostgresStore(disposed);

        var available = await sut.IsAvailableAsync();

        Assert.False(available);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByEnvAndTimestamp_ReturnsOnlyFlagsNewerThanTimestamp()
    {
        var envId = Guid.NewGuid();
        await InsertFlagAsync(envId, "old", DateTimeOffset.FromUnixTimeMilliseconds(1000));
        await InsertFlagAsync(envId, "mid", DateTimeOffset.FromUnixTimeMilliseconds(2000));
        await InsertFlagAsync(envId, "new", DateTimeOffset.FromUnixTimeMilliseconds(3000));

        var result = (await _sut.GetFlagsAsync(envId, 1500)).Select(DecodeKey).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains("mid", result);
        Assert.Contains("new", result);
    }

    [DockerFact]
    public async Task GetFlagsAsync_ByIds_ReturnsRequestedFlagsOnly()
    {
        var envId = Guid.NewGuid();
        var a = await InsertFlagAsync(envId, "a", DateTimeOffset.UtcNow);
        await InsertFlagAsync(envId, "b", DateTimeOffset.UtcNow);
        var c = await InsertFlagAsync(envId, "c", DateTimeOffset.UtcNow);

        var result = (await _sut.GetFlagsAsync([a.ToString(), c.ToString()])).Select(DecodeKey).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains("a", result);
        Assert.Contains("c", result);
    }

    [DockerFact]
    public async Task GetSegmentAsync_KnownId_ReturnsSerializedSegment()
    {
        var id = await InsertSegmentAsync(Guid.NewGuid(), Guid.NewGuid(), "finance", DateTimeOffset.UtcNow);

        var bytes = await _sut.GetSegmentAsync(id.ToString());

        var json = JsonSerializer.Deserialize<JsonElement>(Encoding.UTF8.GetString(bytes));
        Assert.Equal("finance", json.GetProperty("name").GetString());
        Assert.Equal(id, Guid.Parse(json.GetProperty("id").GetString()!));
    }

    [DockerFact]
    public async Task GetSegmentsAsync_NoOrganizationForEnv_ReturnsEmpty()
    {
        var orphanedEnvId = Guid.NewGuid();

        var result = await _sut.GetSegmentsAsync(orphanedEnvId, 0);

        Assert.Empty(result);
    }

    private async Task<Guid> InsertFlagAsync(Guid envId, string key, DateTimeOffset updatedAt)
    {
        var id = Guid.NewGuid();
        await using var conn = await _dataSource.OpenConnectionAsync();
        await conn.ExecuteAsync(
            """
            INSERT INTO feature_flags
              (id, env_id, revision, name, description, key, variation_type, variations, target_users, rules,
               is_enabled, disabled_variation_id, fallthrough, expt_include_all_targets, tags, is_archived,
               created_at, updated_at, creator_id, updator_id)
            VALUES
              (@id, @envId, @revision, @name, '', @key, 'string', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
               true, '', '{}'::jsonb, false, ARRAY[]::text[], false,
               @createdAt, @updatedAt, @creatorId, @updatorId);
            """,
            new
            {
                id,
                envId,
                revision = Guid.NewGuid(),
                name = key,
                key,
                createdAt = updatedAt,
                updatedAt,
                creatorId = Guid.NewGuid(),
                updatorId = Guid.NewGuid()
            });

        return id;
    }

    private async Task<Guid> InsertSegmentAsync(Guid workspaceId, Guid envId, string name, DateTimeOffset updatedAt)
    {
        var id = Guid.NewGuid();
        await using var conn = await _dataSource.OpenConnectionAsync();
        await conn.ExecuteAsync(
            """
            INSERT INTO segments
              (id, workspace_id, env_id, name, key, type, scopes, description, included, excluded, rules,
               is_archived, created_at, updated_at)
            VALUES
              (@id, @workspaceId, @envId, @name, @name, 'general', ARRAY[]::text[], '',
               ARRAY[]::text[], ARRAY[]::text[], '[]'::jsonb,
               false, @createdAt, @updatedAt);
            """,
            new
            {
                id,
                workspaceId,
                envId,
                name,
                createdAt = updatedAt,
                updatedAt
            });

        return id;
    }

    private static string DecodeKey(byte[] bytes)
    {
        var json = JsonSerializer.Deserialize<JsonElement>(Encoding.UTF8.GetString(bytes));
        return json.GetProperty("key").GetString()!;
    }
}
