using System.Diagnostics;
using System.Text;
using Confluent.Kafka;
using Domain.Observability;
using Infrastructure.MQ.Kafka;
using Infrastructure.UnitTests;

namespace Infrastructure.UnitTests.MQ.Kafka;

/// <summary>
/// Pins the bridge between Kafka message headers and W3C trace context.
/// </summary>
/// <remarks>
/// <para>
/// Without trace context on the wire, a flag change produced by the API and consumed by the
/// evaluation server lands in two unjoinable traces, so "how long did this change take to
/// propagate" cannot be answered from the trace backend at all.
/// </para>
/// <para>
/// The property that makes this safe to deploy without an ordering requirement is that headers are
/// ignorable in <b>both</b> directions: an old consumer skips a header it does not read, and a new
/// consumer treats an absent or malformed header as "no parent", which is exactly the behavior
/// that existed before. Both directions are asserted here, because a rollout that only worked in
/// one of them would break flag propagation in a way nothing logs.
/// </para>
/// </remarks>
[Collection(ActivityCorrelationCollection.Name)]
public class KafkaTraceContextTests
{
    private const string TestSource = "FeatBit.Tests.KafkaPropagation";

    [Fact]
    public void Inject_WithNoAmbientActivity_ProducesNoHeaders()
    {
        // Null rather than an empty collection, so the produced message is byte-for-byte what an
        // older producer would have written.
        Assert.Null(KafkaTraceContext.Inject(null));
    }

    [Fact]
    public void Inject_WithAnActivity_WritesTheTraceParentHeader()
    {
        using var listener = Listen();
        using var source = new ActivitySource(TestSource);
        using var activity = source.StartActivity("publish");

        Assert.NotNull(activity);

        var headers = KafkaTraceContext.Inject(activity);

        Assert.NotNull(headers);
        Assert.True(headers.TryGetLastBytes(TraceContextPropagation.TraceParentHeader, out var bytes));
        Assert.Equal(activity.Id, Encoding.UTF8.GetString(bytes));
    }

    [Fact]
    public void InjectThenExtract_RoundTripsTheProducersContext()
    {
        // The whole point of the change, exercised through the real Headers type rather than
        // through strings: what the producer writes is what the consumer reads.
        using var listener = Listen();
        using var source = new ActivitySource(TestSource);
        using var producer = source.StartActivity("publish");

        Assert.NotNull(producer);

        var headers = KafkaTraceContext.Inject(producer);
        var context = KafkaTraceContext.Extract(headers);

        Assert.Equal(producer.TraceId, context.TraceId);
        Assert.Equal(producer.SpanId, context.SpanId);
        Assert.True(context.IsRemote);
    }

    [Fact]
    public void Extract_FromAMessageWithNoHeaders_YieldsNoParent()
    {
        // An old producer. This is the direction that must keep working during a rolling upgrade.
        Assert.Equal(default(ActivityContext), KafkaTraceContext.Extract(null));
        Assert.Equal(default(ActivityContext), KafkaTraceContext.Extract(new Headers()));
    }

    [Fact]
    public void Extract_FromUnrelatedHeaders_YieldsNoParent()
    {
        var headers = new Headers { { "x-some-other-header", "value"u8.ToArray() } };

        Assert.Equal(default(ActivityContext), KafkaTraceContext.Extract(headers));
    }

    [Theory]
    [InlineData("")]
    [InlineData("garbage")]
    [InlineData("00-not-a-trace-id-01")]
    public void Extract_FromAMalformedTraceParent_YieldsNoParent(string value)
    {
        // Degrading to a fresh trace is required: this runs on the consume path for every message,
        // so throwing here would turn a cosmetic header problem into lost message handling.
        var headers = new Headers
        {
            { TraceContextPropagation.TraceParentHeader, Encoding.UTF8.GetBytes(value) }
        };

        Assert.Equal(default(ActivityContext), KafkaTraceContext.Extract(headers));
    }

    [Fact]
    public void Extract_FromAnOversizedTraceParent_YieldsNoParent()
    {
        // A remote producer must not be able to make this process allocate an arbitrarily large
        // string while handling a message.
        var oversized = new string('a', TraceContextPropagation.MaxHeaderLength + 1);
        var headers = new Headers
        {
            { TraceContextPropagation.TraceParentHeader, Encoding.UTF8.GetBytes(oversized) }
        };

        Assert.Equal(default(ActivityContext), KafkaTraceContext.Extract(headers));
    }

    [Fact]
    public void Extract_WithRepeatedTraceParentHeaders_UsesTheLast()
    {
        // Kafka permits repeated keys and W3C says the last value wins, so this pins
        // TryGetLastBytes rather than TryGetBytes.
        using var listener = Listen();
        using var source = new ActivitySource(TestSource);

        var first = source.StartActivity("first");
        Assert.NotNull(first);
        var firstId = first.Id!;
        first.Dispose();

        using var second = source.StartActivity("second");
        Assert.NotNull(second);

        var headers = new Headers
        {
            { TraceContextPropagation.TraceParentHeader, Encoding.UTF8.GetBytes(firstId) },
            { TraceContextPropagation.TraceParentHeader, Encoding.UTF8.GetBytes(second.Id!) }
        };

        Assert.Equal(second.SpanId, KafkaTraceContext.Extract(headers).SpanId);
    }

    private static IDisposable Listen()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        return new Cleanup();
    }

    private sealed class Cleanup : IDisposable
    {
        public void Dispose() => ActivityCorrelation.RemoveListener();
    }
}
