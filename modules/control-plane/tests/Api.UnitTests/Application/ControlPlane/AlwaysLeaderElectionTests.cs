using System.Diagnostics.Metrics;
using Api.Application.ControlPlane;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Api.UnitTests.Application.ControlPlane;

/// <summary>
/// #71 leader election is opt-in (default off): <see cref="AlwaysLeaderElection"/> is the
/// <see cref="ILeaderElection"/> served while it is disabled. Verifies it always reports
/// leadership, logs a discoverability hint on startup, and still emits the shared
/// <see cref="RedisLeaderElector.IsLeaderGaugeName"/> gauge (same name/tag as
/// <see cref="RedisLeaderElector"/>) pinned at 1.
/// </summary>
public sealed class AlwaysLeaderElectionTests
{
    private readonly FakeLogger<AlwaysLeaderElection> _logger = new();

    [Fact]
    public void IsLeader_IsAlwaysTrue()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        Assert.True(sut.IsLeader);
    }

    [Fact]
    public void InstanceId_IsSetAndStable()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        Assert.NotEqual(Guid.Empty, sut.InstanceId);
        Assert.Equal(sut.InstanceId, sut.InstanceId);
    }

    [Fact]
    public async Task StartAsync_LogsDiscoverabilityHint()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        await sut.StartAsync(CancellationToken.None);

        var record = Assert.Single(_logger.Collector.GetSnapshot(), x =>
            x.Level == LogLevel.Information &&
            x.Message.Contains("Leader election disabled"));
        Assert.Null(record.Exception);
    }

    [Fact]
    public async Task StopAsync_CompletesWithoutError()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        await sut.StartAsync(CancellationToken.None);
        await sut.StopAsync(CancellationToken.None);
    }

    [Fact]
    public void IsLeaderGauge_ReportsConstantOne_WithSameNameAndTagAsRedisLeaderElector()
    {
        using var sut = new AlwaysLeaderElection(_logger);

        var values = new List<(int Value, string? InstanceId)>();

        using var listener = new MeterListener
        {
            InstrumentPublished = (instrument, l) =>
            {
                if (instrument.Meter.Name == CommitCoordinatorWorker.MeterName
                    && instrument.Name == RedisLeaderElector.IsLeaderGaugeName)
                {
                    l.EnableMeasurementEvents(instrument);
                }
            }
        };

        listener.SetMeasurementEventCallback<int>((_, measurement, tags, _) =>
        {
            string? instanceId = null;
            foreach (var tag in tags)
            {
                if (tag.Key == "instance_id" && tag.Value is string id)
                {
                    instanceId = id;
                }
            }

            // Other AlwaysLeaderElection/RedisLeaderElector instances left over from other tests
            // in the same process (each owns its own Meter, per the type doc) may still be
            // publishing on the same meter/gauge name — filter down to THIS test's instance.
            if (instanceId == sut.InstanceId.ToString())
            {
                values.Add((measurement, instanceId));
            }
        });

        listener.Start();
        listener.RecordObservableInstruments();

        var reading = Assert.Single(values);
        Assert.Equal(1, reading.Value);
        Assert.Equal(sut.InstanceId.ToString(), reading.InstanceId);
    }
}
