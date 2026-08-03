using Domain.FeatureFlags;
using Domain.Utils;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;
using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

/// <summary>
/// #72b acceptance: with the xmin concurrency token in place (#76), FeatureFlagService's
/// SetPendingAsync/PromotePendingAsync survive a racing writer's DbUpdateConcurrencyException by
/// detaching the stale tracked entity and retrying — the version guards re-evaluate against the
/// fresh row, converging to the same semantics the Mongo provider gets from its version-filtered
/// UpdateOneAsync/ReplaceOneAsync: the loser of a race either no-ops (SetPendingAsync) or returns
/// false (PromotePendingAsync); it never throws and never clobbers the winner.
///
/// #107 acceptance: the retry budget was raised (3 -> PendingOpRetryPolicy.MaxRetries=8) with
/// jittered backoff so that even a synchronized ("lock-step") herd of racers converges reliably
/// instead of occasionally exhausting the budget, and any exhaustion that does happen logs an
/// ERROR with actionable context before rethrowing.
///
/// Integration test against a real Postgres Testcontainers instance.
/// </summary>
[Collection(PostgresCollection.Name)]
public sealed class FeatureFlagRetryOnConflictPostgresTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly PostgresFixture _fixture;

    public FeatureFlagRetryOnConflictPostgresTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private readonly string _dbName = "featureflagretryonconfli_{Guid.NewGuid():N}";
    private string _connectionString = null!;

    private NpgsqlDataSource _dataSource = null!;
    private readonly Guid _envId = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        // Mirror the production data source: dynamic JSON is required for the jsonb POCO
        // columns (Variations/Rules/Fallthrough/Pending), and the snake_case naming convention
        // is required so EnsureCreated materializes the expected columns (incl. the xmin token).
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

    private FeatureFlag CreateFlag(string key, bool isEnabled = false)
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
    public async Task SetPending_LosingRacer_NoOps_And_Winner_Survives()
    {
        const string key = "retry-setpending-race";

        // Seed the committed row via its own throwaway context/service.
        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new FeatureFlagService(seedContext, NullLogger<FeatureFlagService>.Instance);
            var committed = CreateFlag(key, isEnabled: false);
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
        }

        await using var contextA = new AppDbContext(CreateOptions());
        await using var contextB = new AppDbContext(CreateOptions());
        var serviceA = new FeatureFlagService(contextA, NullLogger<FeatureFlagService>.Instance);
        var serviceB = new FeatureFlagService(contextB, NullLogger<FeatureFlagService>.Instance);

        // B "already read v1 state": force contextB to track the row before A's write lands, so
        // its identity map later hands back this same stale instance instead of a fresh query.
        await serviceB.GetAsync(_envId, key);

        // A wins the race: fresh read via contextA, stages v2, commits — xmin advances.
        await serviceA.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: true), version: 2);

        // B, the loser, now attempts to stage an equal version using its stale tracked copy.
        // Internally: guard passes against the STALE state (no pending yet) -> SaveChanges hits
        // the now-advanced xmin -> DbUpdateConcurrencyException -> detach & retry -> fresh read
        // shows A's pending (v2) -> guard (version <= Pending.Version) now fires -> no-op.
        await serviceB.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: false), version: 2);

        // Assert: no exception escaped, and A's pending is still the one in the row.
        await using var verifyContext = new AppDbContext(CreateOptions());
        var verifyService = new FeatureFlagService(verifyContext, NullLogger<FeatureFlagService>.Instance);
        var raw = await verifyService.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(2, raw.Pending!.Version);
        Assert.True(raw.Pending.Value.IsEnabled);
        Assert.Equal(1, raw.CommittedVersion);
    }

    [DockerFact]
    public async Task PromotePending_Returns_False_When_Pending_Replaced_Concurrently()
    {
        const string key = "retry-promote-race";

        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new FeatureFlagService(seedContext, NullLogger<FeatureFlagService>.Instance);
            var committed = CreateFlag(key, isEnabled: false);
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
        }

        await using var contextA = new AppDbContext(CreateOptions());
        await using var contextB = new AppDbContext(CreateOptions());
        var serviceA = new FeatureFlagService(contextA, NullLogger<FeatureFlagService>.Instance);
        var serviceB = new FeatureFlagService(contextB, NullLogger<FeatureFlagService>.Instance);

        // Stage v2 via A.
        await serviceA.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: true), version: 2);

        // B "already read the v2 pending state" (planning to promote expectedVersion 2): force
        // contextB to track the row now, while pending is still v2.
        await serviceB.GetAsync(_envId, key);

        // Concurrently, A re-stages a newer pending (v3) — the "replacement".
        await serviceA.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: false), version: 3);

        // B attempts to promote against its stale expectation (v2). Internally: guard passes
        // against the STALE tracked copy (Pending.Version == 2) -> SaveChanges hits the advanced
        // xmin -> DbUpdateConcurrencyException -> detach & retry -> fresh read shows Pending.Version
        // == 3 -> guard now fires (3 != 2) -> returns false.
        var promoted = await serviceB.PromotePendingAsync(_envId, key, expectedVersion: 2);

        Assert.False(promoted);

        // State intact: still v1 committed, v3 pending — B's stale promote attempt did not clobber it.
        await using var verifyContext = new AppDbContext(CreateOptions());
        var verifyService = new FeatureFlagService(verifyContext, NullLogger<FeatureFlagService>.Instance);
        var raw = await verifyService.GetAsync(_envId, key);
        Assert.Equal(1, raw.CommittedVersion);
        Assert.NotNull(raw.Pending);
        Assert.Equal(3, raw.Pending!.Version);
        Assert.False(raw.Pending.Value.IsEnabled);
    }

    [DockerFact]
    public async Task Concurrent_Stress_No_Lost_Updates()
    {
        const string key = "retry-stress";

        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new FeatureFlagService(seedContext, NullLogger<FeatureFlagService>.Instance);
            var committed = CreateFlag(key, isEnabled: false);
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
        }

        // 20 parallel tasks (14 stagers + 6 promoters), each with its own AppDbContext +
        // FeatureFlagService, doing mixed
        // SetPendingAsync (strictly increasing versions, so every stage is a legitimate advance)
        // and PromotePendingAsync (a spread of expected versions, some of which will hit and some
        // of which will miss depending on timing).
        var stagedVersions = Enumerable.Range(2, 14).Select(v => (long)v).ToArray(); // 2..15
        var promoteExpectedVersions = new long[] { 4, 6, 8, 10, 12, 14 };

        var options = CreateOptions();

        var setTasks = stagedVersions.Select(version => Task.Run(async () =>
        {
            await using var context = new AppDbContext(options);
            var service = new FeatureFlagService(context, NullLogger<FeatureFlagService>.Instance);
            await service.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: version % 2 == 0), version);
        }));

        var promoteTasks = promoteExpectedVersions.Select(expected => Task.Run(async () =>
        {
            await using var context = new AppDbContext(options);
            var service = new FeatureFlagService(context, NullLogger<FeatureFlagService>.Instance);
            await service.PromotePendingAsync(_envId, key, expected);
        }));

        // Assert: no unhandled exception escapes the retry loops under contention.
        await Task.WhenAll(setTasks.Concat(promoteTasks));

        // Assert: no lost updates — final state is internally consistent and made only of
        // values that were actually written by one of the tasks above.
        await using var verifyContext = new AppDbContext(options);
        var verifyService = new FeatureFlagService(verifyContext, NullLogger<FeatureFlagService>.Instance);
        var raw = await verifyService.GetAsync(_envId, key);

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
    [DockerFact]
    public async Task LockStepHerd_AllTasks_Complete_Without_Exhausting_Retries()
    {
        const string key = "retry-lockstep-herd";
        const int herdSize = 16;

        await using (var seedContext = new AppDbContext(CreateOptions()))
        {
            var seedService = new FeatureFlagService(seedContext, NullLogger<FeatureFlagService>.Instance);
            var committed = CreateFlag(key, isEnabled: false);
            committed.CommittedVersion = 1;
            await seedService.AddOneAsync(committed);
        }

        var options = CreateOptions();
        var testLogger = new FakeLogger<FeatureFlagService>();

        // Barrier.SignalAndWait releases all herdSize tasks together, so every task's internal
        // GetAsync + SaveChanges attempt fires in the same instant rather than being spread out —
        // the opposite of Concurrent_Stress_No_Lost_Updates' realistic jitter above.
        using var barrier = new Barrier(herdSize);

        var stagedVersions = Enumerable.Range(2, herdSize).Select(v => (long)v).ToArray();

        var tasks = stagedVersions.Select(version => Task.Run(async () =>
        {
            barrier.SignalAndWait();
            await using var context = new AppDbContext(options);
            var service = new FeatureFlagService(context, testLogger);
            await service.SetPendingAsync(_envId, key, CreateFlag(key, isEnabled: version % 2 == 0), version);
        }));

        // Assert: no unhandled exception escapes any task's retry loop, even under a fully
        // synchronized herd — i.e. nobody exhausted PendingOpRetryPolicy.MaxRetries.
        await Task.WhenAll(tasks);

        // Corroborate via the logger: an exhaustion would have logged an ERROR (see
        // SetPendingAsync's final catch block) before rethrowing. None should have fired.
        Assert.DoesNotContain(testLogger.Collector.GetSnapshot(), r => r.Message.Contains("exhausted"));

        // Assert: no lost updates — the highest version wins the pending slot.
        await using var verifyContext = new AppDbContext(options);
        var verifyService = new FeatureFlagService(verifyContext, NullLogger<FeatureFlagService>.Instance);
        var raw = await verifyService.GetAsync(_envId, key);
        Assert.NotNull(raw.Pending);
        Assert.Equal(stagedVersions.Max(), raw.Pending!.Version);
        Assert.Equal(1, raw.CommittedVersion);
    }

    // #107: a genuine forced-conflict exhaustion test (a pack of hostile background writers
    // hammering the same row so the SUT's every SaveChanges attempt collides) was attempted here
    // and deliberately dropped: even with 8 continuous hostile writers, the SUT's own retry loop
    // reliably won a race within its budget every time (0/5 manual runs reproduced exhaustion) —
    // there is no testing seam in production code to force a deterministic collision on every one
    // of the SUT's 9 attempts without either (a) adding a test-only hook to production code, which
    // is out of scope for this fix, or (b) an inherently flaky timing race. Per the #107 plan, the
    // fallback is used instead: PendingOpRetryPolicyTests (Application.UnitTests) asserts the
    // shared budget/backoff constants are wired as documented, and the logging call sites
    // (FeatureFlagService/SegmentService SetPendingAsync/PromotePendingAsync final catch blocks)
    // were verified by code review to log before rethrowing.
}
