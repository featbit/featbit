using Domain.Segments;
using Domain.Targeting;
using Domain.Utils;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Logging.Abstractions;
using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

/// <summary>
/// #72c acceptance: with the xmin concurrency token in place (#76), SegmentService's
/// SetPendingAsync/PromotePendingAsync survive a racing writer's DbUpdateConcurrencyException by
/// detaching the stale tracked entity and retrying — the version guards re-evaluate against the
/// fresh row, converging to the same semantics the Mongo provider gets from its version-filtered
/// UpdateOneAsync/ReplaceOneAsync: the loser of a race either no-ops (SetPendingAsync) or returns
/// false (PromotePendingAsync); it never throws and never clobbers the winner.
///
/// #107 acceptance: the retry budget was raised (3 -> PendingOpRetryPolicy.MaxRetries=8) with
/// jittered backoff so that even a synchronized ("lock-step") herd of racers converges reliably
/// instead of occasionally exhausting the budget, and any exhaustion that does happen logs an
/// ERROR with actionable context before rethrowing (see PendingOpRetryPolicyTests,
/// Application.UnitTests, for the budget/backoff wiring check — the retry/backoff/logging code
/// under test here is shared with FeatureFlagService via PendingOpRetryPolicy).
///
/// Integration test against a real Postgres Testcontainers instance.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class SegmentRetryOnConflictPostgresTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;

    public SegmentRetryOnConflictPostgresTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private readonly string _dbName = "segmentretryonconflictpg_{Guid.NewGuid():N}";
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
        // EnsureCreated materializes the expected columns (incl. the xmin token).
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
    public async Task SetPending_LosingRacer_NoOps_And_Winner_Survives()
    {
        const string key = "retry-setpending-race";

        Guid segmentId;

        // Seed the committed row via its own throwaway context/service.
        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new SegmentService(seedContext, NullLogger<SegmentService>.Instance);
            var committed = CreateSegment(key, "old");
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
            segmentId = committed.Id;
        }

        await using var contextA = new AppDbContext(CreateOptions());
        await using var contextB = new AppDbContext(CreateOptions());
        var serviceA = new SegmentService(contextA, NullLogger<SegmentService>.Instance);
        var serviceB = new SegmentService(contextB, NullLogger<SegmentService>.Instance);

        // B "already read v1 state": force contextB to track the row before A's write lands, so
        // its identity map later hands back this same stale instance instead of a fresh query.
        await serviceB.GetAsync(segmentId);

        // A wins the race: fresh read via contextA, stages v2, commits — xmin advances.
        await serviceA.SetPendingAsync(segmentId, CreateSegment(key, "new-a"), version: 2);

        // B, the loser, now attempts to stage an equal version using its stale tracked copy.
        // Internally: guard passes against the STALE state (no pending yet) -> SaveChanges hits
        // the now-advanced xmin -> DbUpdateConcurrencyException -> detach & retry -> fresh read
        // shows A's pending (v2) -> guard (version <= Pending.Version) now fires -> no-op.
        await serviceB.SetPendingAsync(segmentId, CreateSegment(key, "new-b"), version: 2);

        // Assert: no exception escaped, and A's pending is still the one in the row.
        await using var verifyContext = new AppDbContext(CreateOptions());
        var verifyService = new SegmentService(verifyContext, NullLogger<SegmentService>.Instance);
        var raw = await verifyService.GetAsync(segmentId);
        Assert.NotNull(raw.Pending);
        Assert.Equal(2, raw.Pending!.Version);
        Assert.Equal("new-a", raw.Pending.Value.Description);
        Assert.Equal(1, raw.CommittedVersion);
    }

    [DockerFact]
    public async Task PromotePending_Returns_False_When_Pending_Replaced_Concurrently()
    {
        const string key = "retry-promote-race";

        Guid segmentId;

        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new SegmentService(seedContext, NullLogger<SegmentService>.Instance);
            var committed = CreateSegment(key, "old");
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
            segmentId = committed.Id;
        }

        await using var contextA = new AppDbContext(CreateOptions());
        await using var contextB = new AppDbContext(CreateOptions());
        var serviceA = new SegmentService(contextA, NullLogger<SegmentService>.Instance);
        var serviceB = new SegmentService(contextB, NullLogger<SegmentService>.Instance);

        // Stage v2 via A.
        await serviceA.SetPendingAsync(segmentId, CreateSegment(key, "new-a"), version: 2);

        // B "already read the v2 pending state" (planning to promote expectedVersion 2): force
        // contextB to track the row now, while pending is still v2.
        await serviceB.GetAsync(segmentId);

        // Concurrently, A re-stages a newer pending (v3) — the "replacement".
        await serviceA.SetPendingAsync(segmentId, CreateSegment(key, "new-a-v3"), version: 3);

        // B attempts to promote against its stale expectation (v2). Internally: guard passes
        // against the STALE tracked copy (Pending.Version == 2) -> SaveChanges hits the advanced
        // xmin -> DbUpdateConcurrencyException -> detach & retry -> fresh read shows Pending.Version
        // == 3 -> guard now fires (3 != 2) -> returns false.
        var promoted = await serviceB.PromotePendingAsync(segmentId, expectedVersion: 2);

        Assert.False(promoted);

        // State intact: still v1 committed, v3 pending — B's stale promote attempt did not clobber it.
        await using var verifyContext = new AppDbContext(CreateOptions());
        var verifyService = new SegmentService(verifyContext, NullLogger<SegmentService>.Instance);
        var raw = await verifyService.GetAsync(segmentId);
        Assert.Equal(1, raw.CommittedVersion);
        Assert.NotNull(raw.Pending);
        Assert.Equal(3, raw.Pending!.Version);
        Assert.Equal("new-a-v3", raw.Pending.Value.Description);
    }

    [DockerFact]
    public async Task Concurrent_Stress_No_Lost_Updates()
    {
        const string key = "retry-stress";

        Guid segmentId;

        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new SegmentService(seedContext, NullLogger<SegmentService>.Instance);
            var committed = CreateSegment(key, "old");
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
            segmentId = committed.Id;
        }

        // 20 parallel tasks (14 stagers + 6 promoters), each with its own AppDbContext +
        // SegmentService, doing mixed
        // SetPendingAsync (strictly increasing versions, so every stage is a legitimate advance)
        // and PromotePendingAsync (a spread of expected versions, some of which will hit and some
        // of which will miss depending on timing).
        var stagedVersions = Enumerable.Range(2, 14).Select(v => (long)v).ToArray(); // 2..15
        var promoteExpectedVersions = new long[] { 4, 6, 8, 10, 12, 14 };

        var options = CreateOptions();

        var setTasks = stagedVersions.Select(version => Task.Run(async () =>
        {
            await using var context = new AppDbContext(options);
            var service = new SegmentService(context, NullLogger<SegmentService>.Instance);
            await service.SetPendingAsync(segmentId, CreateSegment(key, $"v{version}"), version);
        }));

        var promoteTasks = promoteExpectedVersions.Select(expected => Task.Run(async () =>
        {
            await using var context = new AppDbContext(options);
            var service = new SegmentService(context, NullLogger<SegmentService>.Instance);
            await service.PromotePendingAsync(segmentId, expected);
        }));

        // Assert: no unhandled exception escapes the retry loops under contention.
        await Task.WhenAll(setTasks.Concat(promoteTasks));

        // Assert: no lost updates — final state is internally consistent and made only of
        // values that were actually written by one of the tasks above.
        await using var verifyContext = new AppDbContext(options);
        var verifyService = new SegmentService(verifyContext, NullLogger<SegmentService>.Instance);
        var raw = await verifyService.GetAsync(segmentId);

        Assert.True(raw.CommittedVersion == 1 || stagedVersions.Contains(raw.CommittedVersion));
        if (raw.Pending != null)
        {
            Assert.True(raw.Pending.Version > raw.CommittedVersion);
            Assert.Contains(raw.Pending.Version, stagedVersions);
        }
    }

    // #107: the genuine "lock-step herd" extreme — every racer released at (as close as the
    // thread pool allows to) the exact same instant, with no per-task startup jitter at all. This
    // is what the old 3-retry budget could occasionally (~1-in-5 observed) fail to absorb, since a
    // racer near the back of the herd could need more than 3 retries to land its write. With
    // PendingOpRetryPolicy.MaxRetries=8 and jittered backoff, this should now converge reliably.
    // See PendingOpRetryPolicyTests (Application.UnitTests) for the budget/backoff wiring check
    // (the retry/backoff/logging code under test here is shared via PendingOpRetryPolicy).
    [DockerFact]
    public async Task LockStepHerd_AllTasks_Complete_Without_Exhausting_Retries()
    {
        const string key = "retry-lockstep-herd";
        const int herdSize = 16;

        Guid segmentId;

        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new SegmentService(seedContext, NullLogger<SegmentService>.Instance);
            var committed = CreateSegment(key, "old");
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
            segmentId = committed.Id;
        }

        var options = CreateOptions();
        var testLogger = new FakeLogger<SegmentService>();

        // Barrier.SignalAndWait releases all herdSize tasks together, so every task's internal
        // GetAsync + SaveChanges attempt fires in the same instant rather than being spread out —
        // the opposite of Concurrent_Stress_No_Lost_Updates' realistic jitter above.
        using var barrier = new Barrier(herdSize);

        var stagedVersions = Enumerable.Range(2, herdSize).Select(v => (long)v).ToArray();

        var tasks = stagedVersions.Select(version => Task.Run(async () =>
        {
            barrier.SignalAndWait();
            await using var context = new AppDbContext(options);
            var service = new SegmentService(context, testLogger);
            await service.SetPendingAsync(segmentId, CreateSegment(key, $"v{version}"), version);
        }));

        // Assert: no unhandled exception escapes any task's retry loop, even under a fully
        // synchronized herd — i.e. nobody exhausted PendingOpRetryPolicy.MaxRetries.
        await Task.WhenAll(tasks);

        // Corroborate via the logger: an exhaustion would have logged an ERROR (see
        // SetPendingAsync's final catch block) before rethrowing. None should have fired.
        Assert.DoesNotContain(testLogger.Collector.GetSnapshot(), r => r.Message.Contains("exhausted"));

        // Assert: no lost updates — the highest version wins the pending slot.
        await using var verifyContext = new AppDbContext(options);
        var verifyService = new SegmentService(verifyContext, NullLogger<SegmentService>.Instance);
        var raw = await verifyService.GetAsync(segmentId);
        Assert.NotNull(raw.Pending);
        Assert.Equal(stagedVersions.Max(), raw.Pending!.Version);
        Assert.Equal(1, raw.CommittedVersion);
    }
}
