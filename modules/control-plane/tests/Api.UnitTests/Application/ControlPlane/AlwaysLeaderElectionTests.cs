using System.Diagnostics.Metrics;
using Api.Application.ControlPlane;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Api.UnitTests.Application.ControlPlane;

/// <summary>
/// #71 leader election is opt-in (default off): <see cref="AlwaysLeaderElection"/> is the
/// <see cref="ILeaderElection"/> served while it is disabled. Verifies it always reports
/// leadership, logs a discoverability hint on startup, and still emits the shared
/// <see cref="RedisLeaderElector.IsLeaderGaugeName"/> gauge (same name as
/// <see cref="RedisLeaderElector"/>) pinned at 1.
/// </summary>
public sealed class AlwaysLeaderElectionTests
{
    private readonly FakeLogger<AlwaysLeaderElection> _logger = new();

    [Fact]
    public void IsLeader_ForAnyInstance_IsAlwaysTrue()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        Assert.True(sut.IsLeader);
    }

    [Fact]
    public void InstanceId_ReadRepeatedly_IsNonEmptyAndStable()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        Assert.NotEqual(Guid.Empty, sut.InstanceId);
        Assert.Equal(sut.InstanceId, sut.InstanceId);
    }

    [Fact]
    public async Task StartAsync_WhenLeaderElectionIsDisabled_LogsADiscoverabilityHint()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        await sut.StartAsync(CancellationToken.None);

        var record = Assert.Single(_logger.Collector.GetSnapshot(), x =>
            x.Level == LogLevel.Information &&
            x.Message.Contains("Leader election disabled"));
        Assert.Null(record.Exception);
    }

    [Fact]
    public async Task StopAsync_AfterStartAsync_CompletesWithoutError()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        await sut.StartAsync(CancellationToken.None);
        await sut.StopAsync(CancellationToken.None);
    }

    [Fact]
    public void IsLeaderGauge_ReportsConstantOne_WithSameNameAsRedisLeaderElector()
    {
        Instrument? sutGauge = null;
        var capturing = false;

        using var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                // Other AlwaysLeaderElection/RedisLeaderElector instances left over from other
                // tests in the same process publish the SAME meter and gauge name (each owns its
                // own Meter, per the type doc). The gauge carries no instance_id tag — that is
                // banned by the cardinality budget — so disambiguate by Meter INSTANCE instead:
                // only capture the instrument published while constructing this test's sut.
                if (!capturing)
                {
                    return;
                }

                if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                    && instrument.Name == RedisLeaderElector.IsLeaderGaugeName)
                {
                    sutGauge = instrument;
                    l.EnableMeasurementEvents(instrument);
                }
            }
        };

        // Start first so every pre-existing instrument drains while capturing is still false.
        listener.Start();

        capturing = true;
        using var sut = new AlwaysLeaderElection(_logger);
        capturing = false;

        Assert.NotNull(sutGauge);

        var values = new List<int>();
        listener.SetMeasurementEventCallback<int>((_, measurement, tags, _) =>
        {
            Assert.Empty(tags.ToArray());
            values.Add(measurement);
        });

        listener.RecordObservableInstruments();

        Assert.Equal(1, Assert.Single(values));
        Assert.True(sut.IsLeader);
    }
}
