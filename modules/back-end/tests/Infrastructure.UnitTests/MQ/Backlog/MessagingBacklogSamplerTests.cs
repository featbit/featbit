using Domain.Observability;
using FeatBit.Observability.TestKit;
using Infrastructure.MQ.Backlog;
using Microsoft.Extensions.Logging.Abstractions;

namespace Infrastructure.UnitTests.MQ.Backlog;

/// <summary>
/// Behavioral tests for the message-queue backlog sampler.
/// </summary>
/// <remarks>
/// <para>
/// The property worth defending here is that an <b>unknown</b> depth is never reported as zero. A
/// zero reads as "the queue is drained", which is the single most misleading thing a backlog gauge
/// can say while a broker is unreachable — it silences exactly the alert the gauge exists to raise.
/// Several of these tests exist only to pin that distinction.
/// </para>
/// <para>
/// The sampler is driven through <c>SampleOnceAsync</c> rather than by starting it and waiting, so
/// nothing here sleeps or races a timer.
/// </para>
/// <para>
/// Every sampler registers observable gauges on the process-wide <c>MessagingMetrics.Current</c>
/// meter, and an <c>ObservableGauge</c> cannot be unregistered — so gauges from earlier tests are
/// still live when a later one collects. Each test instance therefore uses a unique provider and
/// topic vocabulary, which is what allows exact-count assertions to stay exact.
/// </para>
/// </remarks>
[Collection(nameof(BacklogSamplerCollection))]
public class MessagingBacklogSamplerTests
{
    private readonly string _provider = $"probe-{Guid.NewGuid():N}";
    private readonly string _topicA = $"featbit-backlog-a-{Guid.NewGuid():N}";
    private readonly string _topicB = $"featbit-backlog-b-{Guid.NewGuid():N}";

    [Fact]
    public void Constructor_WithProbes_RegistersOneGaugePerTopic()
    {
        // Arrange
        var probe = new StubProbe(_provider, [_topicA, _topicB]);
        using var collector = new MetricCollector(MessagingMetrics.Current.Meter, "messaging.backlog");

        // Act
        _ = CreateSut(probe);
        collector.CollectObservableInstruments();

        // Assert
        var measurements = Mine(collector);

        Assert.Equal(2, measurements.Length);
        Assert.Contains(measurements, m => m.Tag(ObservabilityTags.Destination) == _topicA);
        Assert.Contains(measurements, m => m.Tag(ObservabilityTags.Destination) == _topicB);
    }

    [Fact]
    public void Constructor_BeforeAnySample_ReportsUnknownRatherThanZero()
    {
        // Arrange
        var probe = new StubProbe(_provider, [_topicA]);
        using var collector = new MetricCollector(MessagingMetrics.Current.Meter, "messaging.backlog");

        // Act
        var sut = CreateSut(probe);
        collector.CollectObservableInstruments();

        // Assert
        Assert.Equal(MessagingBacklogSampler.Unknown, sut.DepthOf(_provider, _topicA));
        Assert.Equal(MessagingBacklogSampler.Unknown, Assert.Single(Mine(collector)).Value);
    }

    [Fact]
    public async Task SampleOnceAsync_WithADepthPerTopic_PublishesThoseDepths()
    {
        // Arrange
        var probe = new StubProbe(_provider, [_topicA, _topicB])
        {
            Result = new Dictionary<string, long> { [_topicA] = 42, [_topicB] = 0 }
        };
        var sut = CreateSut(probe);
        using var collector = new MetricCollector(MessagingMetrics.Current.Meter, "messaging.backlog");

        // Act
        await sut.SampleOnceAsync(CancellationToken.None);
        collector.CollectObservableInstruments();

        // Assert
        Assert.Equal(42, sut.DepthOf(_provider, _topicA));
        Assert.Equal(0, sut.DepthOf(_provider, _topicB));

        var reported = Assert.Single(
            Mine(collector),
            m => m.Tag(ObservabilityTags.Destination) == _topicA);
        Assert.Equal(42, reported.Value);
        Assert.Equal("{message}", reported.Unit);
    }

    [Fact]
    public async Task SampleOnceAsync_WithATopicMissingFromTheResult_ReportsItAsUnknown()
    {
        // Arrange
        var probe = new StubProbe(_provider, [_topicA, _topicB])
        {
            Result = new Dictionary<string, long> { [_topicA] = 7 }
        };
        var sut = CreateSut(probe);

        // Act
        await sut.SampleOnceAsync(CancellationToken.None);

        // Assert
        Assert.Equal(7, sut.DepthOf(_provider, _topicA));
        Assert.Equal(MessagingBacklogSampler.Unknown, sut.DepthOf(_provider, _topicB));
    }

    [Fact]
    public async Task SampleOnceAsync_WhenAProbeThrows_ReportsUnknownInsteadOfAStaleDepth()
    {
        // Arrange
        var probe = new StubProbe(_provider, [_topicA])
        {
            Result = new Dictionary<string, long> { [_topicA] = 99 }
        };
        var sut = CreateSut(probe);
        await sut.SampleOnceAsync(CancellationToken.None);
        Assert.Equal(99, sut.DepthOf(_provider, _topicA));

        probe.Throw = new InvalidOperationException("broker unreachable");

        // Act
        await sut.SampleOnceAsync(CancellationToken.None);

        // Assert
        // A stale 99 would look like a steady backlog; the truth is that nobody knows.
        Assert.Equal(MessagingBacklogSampler.Unknown, sut.DepthOf(_provider, _topicA));
    }

    [Fact]
    public async Task SampleOnceAsync_WhenOneProbeThrows_StillSamplesTheOthers()
    {
        // Arrange
        var failingProvider = _provider + "-failing";
        var failing = new StubProbe(failingProvider, [_topicA]) { Throw = new TimeoutException() };
        var healthy = new StubProbe(_provider, [_topicB])
        {
            Result = new Dictionary<string, long> { [_topicB] = 5 }
        };
        var sut = CreateSut(failing, healthy);

        // Act
        await sut.SampleOnceAsync(CancellationToken.None);

        // Assert
        Assert.Equal(MessagingBacklogSampler.Unknown, sut.DepthOf(failingProvider, _topicA));
        Assert.Equal(5, sut.DepthOf(_provider, _topicB));
    }

    [Fact]
    public async Task SampleOnceAsync_WhenAProbeThrows_DoesNotPropagateTheException()
    {
        // Arrange
        var probe = new StubProbe(_provider, [_topicA]) { Throw = new InvalidOperationException() };
        var sut = CreateSut(probe);

        // Act
        var exception = await Record.ExceptionAsync(() => sut.SampleOnceAsync(CancellationToken.None));

        // Assert
        // A diagnostic must never be the reason a service stops.
        Assert.Null(exception);
    }

    [Fact]
    public async Task SampleOnceAsync_WhenCancelled_PropagatesTheCancellation()
    {
        // Arrange
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();

        var probe = new StubProbe(_provider, [_topicA])
        {
            Throw = new OperationCanceledException(cts.Token)
        };
        var sut = CreateSut(probe);

        // Act
        var act = () => sut.SampleOnceAsync(cts.Token);

        // Assert
        // Shutdown must not be swallowed as a probe failure, or the loop would keep running.
        await Assert.ThrowsAnyAsync<OperationCanceledException>(act);
    }

    [Fact]
    public void Constructor_WithNoInterval_UsesTheDefault()
    {
        // Arrange & Act
        var sut = CreateSut(interval: null, new StubProbe(_provider, [_topicA]));

        // Assert
        Assert.Equal(MessagingBacklogSampler.DefaultInterval, sut.Interval);
    }

    [Fact]
    public void Constructor_WithAnIntervalBelowTheFloor_ClampsToTheFloor()
    {
        // Arrange & Act
        var sut = CreateSut(TimeSpan.FromMilliseconds(1), new StubProbe(_provider, [_topicA]));

        // Assert
        // Sampling harder than the floor turns a diagnostic into a load generator.
        Assert.Equal(MessagingBacklogSampler.MinimumInterval, sut.Interval);
    }

    [Fact]
    public void Constructor_WithAnIntervalAboveTheFloor_UsesItUnchanged()
    {
        // Arrange
        var requested = TimeSpan.FromMinutes(2);

        // Act
        var sut = CreateSut(requested, new StubProbe(_provider, [_topicA]));

        // Assert
        Assert.Equal(requested, sut.Interval);
    }

    [Fact]
    public async Task ExecuteAsync_WithNoProbes_CompletesWithoutSpinningATimer()
    {
        // Arrange
        var sut = CreateSut();

        // Act
        await sut.StartAsync(CancellationToken.None);
        await sut.ExecuteTask!;

        // Assert
        Assert.True(sut.ExecuteTask.IsCompletedSuccessfully);
    }

    private RecordedMeasurement[] Mine(MetricCollector collector)
        => collector.For("messaging.backlog")
            .Where(m => m.Tag(ObservabilityTags.Provider) == _provider)
            .ToArray();

    private static MessagingBacklogSampler CreateSut(params IBacklogProbe[] probes)
        => CreateSut(TimeSpan.FromSeconds(30), probes);

    private static MessagingBacklogSampler CreateSut(TimeSpan? interval, params IBacklogProbe[] probes)
        => new(probes, NullLogger<MessagingBacklogSampler>.Instance, interval);

    private sealed class StubProbe(string provider, string[] topics) : IBacklogProbe
    {
        public string Provider { get; } = provider;

        public IReadOnlyList<string> Topics { get; } = topics;

        public Dictionary<string, long> Result { get; set; } = new();

        public Exception? Throw { get; set; }

        public Task<IReadOnlyDictionary<string, long>> SampleAsync(CancellationToken cancellationToken)
        {
            if (Throw is not null)
            {
                throw Throw;
            }

            return Task.FromResult<IReadOnlyDictionary<string, long>>(Result);
        }
    }
}
