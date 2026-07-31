using Domain.Segments;
using Domain.Targeting;
using Domain.Utils;
using Infrastructure.Persistence.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

/// <summary>
/// #72a acceptance: SegmentConfiguration maps Postgres's built-in xmin system column as an
/// EF shadow row-version property, so a racing writer's UPDATE affects 0 rows and EF throws
/// DbUpdateConcurrencyException instead of silently overwriting the other writer's change.
///
/// Integration test against a real Postgres Testcontainers instance. Uses
/// EnsureCreated() to materialize the EF model, then opens two separate AppDbContext instances
/// on the same row to simulate two concurrent writers. Does NOT touch SegmentService — this
/// only proves the token is wired up; the retry-on-conflict service behavior is #72c.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class SegmentXminConcurrencyPostgresTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;

    public SegmentXminConcurrencyPostgresTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private readonly string _dbName = "segmentxminconcurrencypg_{Guid.NewGuid():N}";
    private string _connectionString = null!;
    private NpgsqlDataSource _dataSource = null!;
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _envId = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        // Mirror the production data source: dynamic JSON is required for the jsonb POCO
        // columns (Rules/Pending), and the snake_case naming convention is required so
        // EnsureCreated materializes the expected columns.
        _connectionString = new NpgsqlConnectionStringBuilder(_fixture.ConnectionString)
        {
            Database = _dbName
        }.ConnectionString;

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(_connectionString);
        dataSourceBuilder
            .EnableDynamicJson()
            .ConfigureJsonOptions(ReusableJsonSerializerOptions.Web);
        _dataSource = dataSourceBuilder.Build();

        var options = CreateOptions();
        await using var dbContext = new AppDbContext(options);
        // materializes the EF model (incl. the xmin shadow property mapping)
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        if (_dataSource != null!)
        {
            var options = CreateOptions();
            await using (var dbContext = new AppDbContext(options))
            {
                await dbContext.Database.EnsureDeletedAsync();
            }

            await _dataSource.DisposeAsync();
        }
    }

    private DbContextOptions<AppDbContext> CreateOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_dataSource)
            .UseSnakeCaseNamingConvention()
            .Options;
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
    public async Task ConcurrentUpdate_Throws_DbUpdateConcurrencyException()
    {
        // Arrange: create the row via a throwaway context, then close it.
        // (Id is left default(Guid) so EF's client-side value generator assigns it on save.)
        var segment = CreateSegment("xmin-segment", "old");
        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            await seedContext.Set<Segment>().AddAsync(segment);
            await seedContext.SaveChangesAsync();
        }

        var segmentId = segment.Id;

        // Act: two separate contexts load the same row.
        await using var contextA = new AppDbContext(CreateOptions());
        await using var contextB = new AppDbContext(CreateOptions());

        var segmentA = await contextA.Set<Segment>().SingleAsync(x => x.Id == segmentId);
        var segmentB = await contextB.Set<Segment>().SingleAsync(x => x.Id == segmentId);

        segmentA.Description = "updated-by-a";
        await contextA.SaveChangesAsync();

        segmentB.Description = "updated-by-b";

        // Assert: B's UPDATE carries B's original xmin, which no longer matches the row (A
        // already advanced it), so it affects 0 rows and EF throws.
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => contextB.SaveChangesAsync());
    }
}
