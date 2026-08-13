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
/// C3b-1 Part 1 (Postgres/EF): GetPendingAsync filters on the jsonb "pending" column
/// (Where(f => f.Pending != null)) and that filter must translate to a server-side scan.
/// Enumerates every flag (across all envs) with a staged change; excludes committed-only flags.
///
/// Integration test against a real Postgres Testcontainers instance.
/// EnsureCreated() materializes the EF model (incl. committed_version/pending). uses the shared Postgres Testcontainers fixture.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class FeatureFlagGetPendingPostgresTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;

    public FeatureFlagGetPendingPostgresTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private readonly string _dbName = "featureflaggetpendingpg_{Guid.NewGuid():N}";
    private string _connectionString = null!;
    private NpgsqlDataSource _dataSource = null!;
    private AppDbContext _dbContext = null!;
    private FeatureFlagService _sut = null!;

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

        await _sut.AddOneAsync(CreateFlag(envA, "a-committed-only", isEnabled: false));

        await _sut.AddOneAsync(CreateFlag(envA, "a-pending", isEnabled: false));
        await _sut.SetPendingAsync(envA, "a-pending", CreateFlag(envA, "a-pending", true), version: 2);

        await _sut.AddOneAsync(CreateFlag(envB, "b-pending", isEnabled: false));
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
