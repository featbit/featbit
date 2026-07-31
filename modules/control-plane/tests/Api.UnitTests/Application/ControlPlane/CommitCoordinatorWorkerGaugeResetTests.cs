using Api.UnitTests.Stubs;
using System.Diagnostics.Metrics;
using Api.Application.ControlPlane;
using Application.Caches;
using Application.ControlPlane;
using Application.Services;
using Domain.ControlPlane;
using Domain.FeatureFlags;
using Domain.Messages;
using Domain.Segments;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Api.UnitTests.Application.ControlPlane;

/// <summary>
/// #105: unit coverage for resetting <see cref="CommitCoordinatorWorker"/>'s static gauge snapshots
/// (<c>PendingBacklogSnapshot</c>, <c>AppliedWatermarkLagSnapshot</c> — #108 item 5: the two
/// hand-rolled static-int/list fields these replaced are now each wrapped by a shared
/// <c>ObservableGaugeSnapshot&lt;T&gt;</c>) on the not-leader early-return path. The ObservableGauge
/// callbacks read these snapshots with no leader filter of their own, and — before #105 — they were
/// refreshed only on a leader tick, so a replica that lost leadership kept exporting its stale
/// last-leader snapshot indefinitely. Uses mocked services (no real Mongo/Redis) so this stays a pure
/// unit test: a leader tick with non-empty pending/watermark data sets the gauges, then a NON-leader
/// tick (same static fields, matching how DI would construct a fresh worker instance per resolution)
/// must reset them.
/// </summary>
public class CommitCoordinatorWorkerGaugeResetTests
{
    private static FeatureFlag CreateFlag(string key) => new()
    {
        Id = Guid.NewGuid(),
        EnvId = Guid.NewGuid(),
        UpdatedAt = DateTime.UtcNow
    };

    private static Segment CreateSegment(string key) => new(
        workspaceId: Guid.NewGuid(),
        envId: Guid.NewGuid(),
        name: key,
        key: key,
        type: SegmentType.EnvironmentSpecific,
        scopes: [],
        included: [],
        excluded: [],
        rules: [],
        description: string.Empty);

    private CommitCoordinatorWorker CreateSut(bool isLeader)
    {
        var featureFlagService = new Mock<IFeatureFlagService>();
        featureFlagService.Setup(x => x.GetPendingAsync())
            .ReturnsAsync(new List<FeatureFlag> { CreateFlag("f1"), CreateFlag("f2") });

        var segmentService = new Mock<ISegmentService>();
        segmentService.Setup(x => x.GetPendingAsync())
            .ReturnsAsync(new List<Segment> { CreateSegment("s1") });

        var leaseStore = new Mock<ILeaseStore>();
        leaseStore.Setup(x => x.GetLiveSetAsync(It.IsAny<DateTimeOffset>())).ReturnsAsync(
        [
            new DcLease
            {
                DcId = "west",
                Region = "west",
                LastHeartbeatAt = DateTimeOffset.UtcNow,
                LeaseExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
                AppliedWatermarks = new Dictionary<Guid, long> { [Guid.NewGuid()] = 42 }
            }
        ]);

        var services = new ServiceCollection();
        services.AddTransient(_ => featureFlagService.Object);
        services.AddTransient(_ => segmentService.Object);
        services.AddTransient(_ => leaseStore.Object);
        var provider = services.BuildServiceProvider();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:ConsistencyMode"] = "GatedCommit"
            })
            .Build();

        // A non-Composite ICacheService: the tick still refreshes the gauges/snapshot (done up
        // front, before the composite-cache cast check) and then returns 0 via the "requires the
        // composite Redis cache" warning branch — exactly what this test needs (gauge state without
        // needing a full working CompositeRedisCacheService + staged-DC setup).
        return new CommitCoordinatorWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            Mock.Of<ICacheService>(),
            Mock.Of<IMessageProducer>(),
            new FakeLeaderElection(isLeader),
            configuration,
            NullLogger<CommitCoordinatorWorker>.Instance);
    }

    [Fact]
    public async Task RunOnceAsync_WhenLeadershipIsLost_ZeroesPendingBacklogAndAppliedWatermarkLagGauges()
    {
        var leaderSut = CreateSut(isLeader: true);
        await leaderSut.RunOnceAsync();

        var (flagBacklogBefore, segmentBacklogBefore) = ReadPendingBacklogGauge();
        Assert.Equal(2, flagBacklogBefore);
        Assert.Equal(1, segmentBacklogBefore);
        Assert.NotEmpty(ReadAppliedWatermarkLagGauge());

        // Same static gauge fields; a different instance (as DI creates per resolution) now runs as
        // NON-leader — the gauges must be zeroed/emptied, not left at the former leader's snapshot.
        var nonLeaderSut = CreateSut(isLeader: false);
        var result = await nonLeaderSut.RunOnceAsync();
        Assert.Equal(0, result);

        var (flagBacklogAfter, segmentBacklogAfter) = ReadPendingBacklogGauge();
        Assert.Equal(0, flagBacklogAfter);
        Assert.Equal(0, segmentBacklogAfter);
        Assert.Empty(ReadAppliedWatermarkLagGauge());
    }

    private static (long Flag, long Segment) ReadPendingBacklogGauge()
    {
        var values = new Dictionary<string, long>();

        using var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                    && instrument.Name == CommitCoordinatorWorker.PendingBacklogGaugeName)
                {
                    l.EnableMeasurementEvents(instrument);
                }
            }
        };

        listener.SetMeasurementEventCallback<long>((_, measurement, tags, _) =>
        {
            foreach (var tag in tags)
            {
                if (tag.Key == "resource_type" && tag.Value is string rt)
                {
                    values[rt] = measurement;
                }
            }
        });

        listener.Start();
        listener.RecordObservableInstruments();

        return (values.GetValueOrDefault("flag"), values.GetValueOrDefault("segment"));
    }

    private static List<long> ReadAppliedWatermarkLagGauge()
    {
        var values = new List<long>();

        using var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                    && instrument.Name == CommitCoordinatorWorker.AppliedWatermarkLagGaugeName)
                {
                    l.EnableMeasurementEvents(instrument);
                }
            }
        };

        listener.SetMeasurementEventCallback<long>((_, measurement, _, _) => values.Add(measurement));

        listener.Start();
        listener.RecordObservableInstruments();

        return values;
    }
}
