using System.Diagnostics.Metrics;
using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Behavior of the M5 worker-liveness and buffer-saturation primitives.
/// </summary>
/// <remarks>
/// Both types are constructed against a test-owned <see cref="Meter"/> rather than the process-wide
/// one, so these tests are fully isolated from whatever else the suite is running.
/// </remarks>
public sealed class WorkerAndBufferObservabilityTests
{
    private const string Prefix = "featbit.test.";

    /// <summary>
    /// The distinction the whole primitive exists for: a worker that is looping but never
    /// succeeding must show a FRESH heartbeat age and a STALE success age. If both tracked the same
    /// clock, a spinning-but-failing worker would be indistinguishable from a healthy one.
    /// </summary>
    [Fact]
    public void Heartbeat_WithoutASuccess_DoesNotAdvanceTheLastSuccessAge()
    {
        using var meter = new Meter("FeatBit.Test.Worker." + Guid.NewGuid());
        var worker = new WorkerObservability(meter, Prefix, "test_worker");
        using var collector = new MetricCollector(meter);

        worker.Started();
        worker.Heartbeat();
        collector.CollectObservableInstruments();

        Assert.Equal(0, Gauge(collector, "worker.heartbeat_age"));

        // Never called Success(), so the success age must still be the "never happened" sentinel.
        Assert.Equal(-1, Gauge(collector, "worker.last_success_age"));
    }

    [Fact]
    public void Success_AfterAnIteration_AdvancesBothAges()
    {
        using var meter = new Meter("FeatBit.Test.Worker." + Guid.NewGuid());
        var worker = new WorkerObservability(meter, Prefix, "test_worker");
        using var collector = new MetricCollector(meter);

        worker.Started();
        worker.Success();
        collector.CollectObservableInstruments();

        Assert.Equal(0, Gauge(collector, "worker.heartbeat_age"));
        Assert.Equal(0, Gauge(collector, "worker.last_success_age"));
    }

    [Fact]
    public void Running_AfterStartAndStop_ReportsOneThenZero()
    {
        using var meter = new Meter("FeatBit.Test.Worker." + Guid.NewGuid());
        var worker = new WorkerObservability(meter, Prefix, "test_worker");
        using var collector = new MetricCollector(meter);

        worker.Started();
        collector.CollectObservableInstruments();
        Assert.Equal(1, Gauge(collector, "worker.running"));

        collector.Clear();
        worker.Stopped();
        collector.CollectObservableInstruments();
        Assert.Equal(0, Gauge(collector, "worker.running"));
    }

    /// <summary>
    /// Ages before the first iteration must report -1, not 0. Zero would read as "iterated just
    /// now" and would make a worker that never started look perfectly healthy.
    /// </summary>
    [Fact]
    public void Ages_BeforeFirstIteration_ReportNegativeOneNotZero()
    {
        using var meter = new Meter("FeatBit.Test.Worker." + Guid.NewGuid());
        _ = new WorkerObservability(meter, Prefix, "test_worker");
        using var collector = new MetricCollector(meter);

        collector.CollectObservableInstruments();

        Assert.Equal(-1, Gauge(collector, "worker.heartbeat_age"));
        Assert.Equal(-1, Gauge(collector, "worker.last_success_age"));
        Assert.Equal(0, Gauge(collector, "worker.running"));
    }

    [Fact]
    public void LoopFailed_WithAnException_TagsWorkerAndErrorTypeOnly()
    {
        using var meter = new Meter("FeatBit.Test.Worker." + Guid.NewGuid());
        var worker = new WorkerObservability(meter, Prefix, "test_worker");
        using var collector = new MetricCollector(meter);

        worker.LoopFailed(new TimeoutException("host=db.internal;password=hunter2"));

        var failure = Assert.Single(collector.For("worker.loop_failures"));

        Assert.Equal("test_worker", failure.Tag(ObservabilityTags.Worker));
        Assert.Equal(nameof(TimeoutException), failure.Tag(ObservabilityTags.ErrorType));
        Assert.DoesNotContain(
            failure.Tags.Values,
            value => value?.ToString()?.Contains("hunter2", StringComparison.Ordinal) == true);
    }

    [Fact]
    public void Buffer_RecordDropped_IncrementsByTheDroppedCount()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        var buffer = new BufferObservability(meter, Prefix, "test_buffer", capacity: 10, () => 3);
        using var collector = new MetricCollector(meter);

        buffer.RecordDropped(4);

        var dropped = Assert.Single(collector.For("buffer.items_dropped"));

        Assert.Equal(4, dropped.Value);
        Assert.Equal("test_buffer", dropped.Tag(ObservabilityTags.Buffer));
    }

    [Fact]
    public void Buffer_RecordDropped_IgnoresNonPositiveCounts()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        var buffer = new BufferObservability(meter, Prefix, "test_buffer", capacity: 10);
        using var collector = new MetricCollector(meter);

        buffer.RecordDropped(0);
        buffer.RecordDropped(-1);

        Assert.Empty(collector.For("buffer.items_dropped"));
    }

    /// <summary>
    /// The blocked-writer gauge must be non-zero WHILE a writer is blocked, not after it unblocks.
    /// A gauge that only rises once the pressure is gone reports the opposite of the truth.
    /// </summary>
    [Fact]
    public void Buffer_BlockedWriterScope_IsVisibleWhileBlockedAndClearsOnDispose()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        var buffer = new BufferObservability(meter, Prefix, "test_buffer", capacity: 10);
        using var collector = new MetricCollector(meter);

        using (buffer.TrackBlockedWriter())
        {
            collector.CollectObservableInstruments();
            Assert.Equal(1, Gauge(collector, "buffer.blocked_writers"));
            collector.Clear();
        }

        collector.CollectObservableInstruments();
        Assert.Equal(0, Gauge(collector, "buffer.blocked_writers"));

        var wait = Assert.Single(collector.For("buffer.write_wait"));
        Assert.Equal("ms", wait.Unit);
        Assert.True(wait.Value >= 0);
    }

    [Fact]
    public void Buffer_WithoutAnOccupancyProvider_DoesNotRegisterAnOccupancyGauge()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        _ = new BufferObservability(meter, Prefix, "test_buffer", capacity: 10);
        using var collector = new MetricCollector(meter);

        collector.CollectObservableInstruments();

        // Reporting a hard-coded zero occupancy would be worse than reporting nothing: it looks
        // exactly like a healthy, empty buffer.
        Assert.Empty(collector.For("buffer.items"));
        Assert.Equal(10, Gauge(collector, "buffer.capacity"));
    }

    [Fact]
    public void Buffer_WithNegativeCapacity_DoesNotRegisterACapacityGauge()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        _ = new BufferObservability(meter, Prefix, "unbounded_buffer", capacity: -1, () => 7);
        using var collector = new MetricCollector(meter);

        collector.CollectObservableInstruments();

        Assert.Empty(collector.For("buffer.capacity"));
        Assert.Equal(7, Gauge(collector, "buffer.items"));
    }

    /// <summary>
    /// Byte tracking is opt-in for the same reason the occupancy gauge is: a buffer whose callers
    /// never supply a size would export a constant zero, which reads as "this buffer is holding no
    /// data" rather than "this was never measured".
    /// </summary>
    [Fact]
    public void Buffer_WithoutByteTracking_DoesNotRegisterABytesGauge()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        var buffer = new BufferObservability(meter, Prefix, "test_buffer", capacity: 10, () => 3);
        using var collector = new MetricCollector(meter);

        buffer.AddBytes(512);
        collector.CollectObservableInstruments();

        Assert.Empty(collector.For("buffer.bytes"));
    }

    [Fact]
    public void Buffer_WithByteTracking_ReportsTheNetBufferedBytes()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        var buffer = new BufferObservability(
            meter, Prefix, "test_buffer", capacity: 10, () => 2, trackBytes: true);
        using var collector = new MetricCollector(meter);

        buffer.AddBytes(300);
        buffer.AddBytes(200);
        buffer.RemoveBytes(120);

        collector.CollectObservableInstruments();

        var bytes = Assert.Single(collector.For("buffer.bytes"));

        Assert.Equal(380, bytes.Value);
        Assert.Equal("By", bytes.Unit);
        Assert.Equal("test_buffer", bytes.Tag(ObservabilityTags.Buffer));
    }

    /// <summary>
    /// Accounting drift must not surface as a negative byte count. A gauge reading below zero is
    /// nonsense to a dashboard and to an alert threshold, so the floor is applied at read time.
    /// </summary>
    [Fact]
    public void Buffer_ByteTracking_NeverReportsANegativeValue()
    {
        using var meter = new Meter("FeatBit.Test.Buffer." + Guid.NewGuid());
        var buffer = new BufferObservability(
            meter, Prefix, "test_buffer", capacity: 10, trackBytes: true);
        using var collector = new MetricCollector(meter);

        buffer.AddBytes(100);
        buffer.RemoveBytes(250);

        collector.CollectObservableInstruments();

        Assert.Equal(0, Gauge(collector, "buffer.bytes"));
    }

    private static double Gauge(MetricCollector collector, string name)
        => Assert.Single(collector.For(name)).Value;}
