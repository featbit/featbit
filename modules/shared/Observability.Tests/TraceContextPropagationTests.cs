using System.Diagnostics;
using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Trace context on the wire is what turns a produced message and its consume into one trace
/// instead of two. These tests assert the properties a rolling upgrade depends on: that a real
/// activity round-trips, and that every way a header can be missing or malformed degrades to
/// "start a fresh trace" rather than throwing on the consume path.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class TraceContextPropagationTests
{
    private const string TestSource = "FeatBit.Tests.Propagation";

    [Fact]
    public void TryInject_WithNoActivity_PropagatesNothing()
    {
        // Activity.Current is null whenever nothing is listening, which is the default state of a
        // process with no exporter. It must not be an error.
        var injected = TraceContextPropagation.TryInject(null, out var traceParent, out var traceState);

        Assert.False(injected);
        Assert.Empty(traceParent);
        Assert.Null(traceState);
    }

    [Fact]
    public void TryInject_WithAW3CActivity_RendersTheTraceParent()
    {
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");

        Assert.NotNull(activity);

        var injected = TraceContextPropagation.TryInject(activity, out var traceParent, out _);

        Assert.True(injected);
        // The W3C wire format: version, trace id, span id, flags.
        var parts = traceParent.Split('-');
        Assert.Equal(4, parts.Length);
        Assert.Equal("00", parts[0]);
        Assert.Equal(activity.TraceId.ToHexString(), parts[1]);
        Assert.Equal(activity.SpanId.ToHexString(), parts[2]);
    }

    [Fact]
    public void TryInject_WithAHierarchicalActivity_PropagatesNothing()
    {
        // A hierarchical activity has a non-null Id that is not a traceparent. Checking the format
        // rather than the id is what stops a malformed value going on the wire.
        var activity = new Activity("legacy");
        activity.SetIdFormat(ActivityIdFormat.Hierarchical);
        activity.Start();

        try
        {
            Assert.False(TraceContextPropagation.TryInject(activity, out var traceParent, out _));
            Assert.Empty(traceParent);
        }
        finally
        {
            activity.Stop();
        }
    }

    [Fact]
    public void Extract_ThenStartConsume_ContinuesTheProducersTrace()
    {
        // The property this whole change exists for: the consume shares the producer's trace id and
        // is parented to the producer's span.
        using var cleanup = ListeningSource(out var source);
        using var producer = source.StartActivity("publish");

        Assert.NotNull(producer);
        Assert.True(TraceContextPropagation.TryInject(producer, out var traceParent, out var traceState));

        var context = TraceContextPropagation.Extract(traceParent, traceState);

        Assert.Equal(producer.TraceId, context.TraceId);
        Assert.Equal(producer.SpanId, context.SpanId);
        Assert.True(context.IsRemote);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-traceparent")]
    [InlineData("00-invalid-invalid-01")]
    [InlineData("00-00000000000000000000000000000000-0000000000000000-00")]
    public void Extract_WithAnAbsentOrMalformedTraceParent_YieldsNoParent(string? traceParent)
    {
        // Every one of these must degrade to the pre-existing behavior — a fresh trace — rather
        // than throwing, because this runs on the consume path for every message.
        var context = TraceContextPropagation.Extract(traceParent, traceState: null);

        Assert.Equal(default(ActivityContext), context);
    }

    [Fact]
    public void Extract_WithAnOversizedTraceParent_YieldsNoParent()
    {
        var oversized = new string('a', TraceContextPropagation.MaxHeaderLength + 1);

        Assert.Equal(default(ActivityContext), TraceContextPropagation.Extract(oversized, traceState: null));
    }

    [Fact]
    public void Extract_WithAnOversizedTraceState_KeepsTheParentAndDropsTheState()
    {
        // Losing vendor state costs sampling hints; losing the parent breaks the trace outright, so
        // the parent must survive an unusable tracestate.
        using var cleanup = ListeningSource(out var source);
        using var producer = source.StartActivity("publish");

        Assert.NotNull(producer);
        Assert.True(TraceContextPropagation.TryInject(producer, out var traceParent, out _));

        var oversized = new string('x', TraceContextPropagation.MaxHeaderLength + 1);
        var context = TraceContextPropagation.Extract(traceParent, oversized);

        Assert.Equal(producer.TraceId, context.TraceId);
        Assert.True(string.IsNullOrEmpty(context.TraceState));
    }

    [Fact]
    public void StartConsume_WithoutAParentContext_StartsItsOwnTrace()
    {
        // The two-argument overload must behave exactly as it did before propagation existed,
        // because Redis and Postgres still call it. Each activity is disposed before the next
        // begins, mirroring the consume loop, where messages are handled one at a time.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        try
        {
            ActivityTraceId firstTrace;
            using (var first = IngressActivity.StartConsume("topic-a", MessagingSystems.Redis))
            {
                Assert.NotNull(first);
                firstTrace = first.TraceId;
            }

            using var second = IngressActivity.StartConsume("topic-b", MessagingSystems.Postgres);

            Assert.NotNull(second);
            Assert.NotEqual(firstTrace, second.TraceId);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void StartConsume_WithADefaultContextInsideAnAmbientActivity_InheritsIt()
    {
        // Pinning a real .NET subtlety rather than assuming it away: passing a default
        // ActivityContext does NOT mean "no parent", it means "unspecified", and StartActivity then
        // falls back to Activity.Current. This is harmless where StartConsume is actually called —
        // a consume loop has no ambient activity — but it would silently graft every unparented
        // message onto whatever span happened to be current if one were ever introduced above it.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        try
        {
            using var source = new ActivitySource(TestSource);
            using var ambient = source.StartActivity("ambient");

            Assert.NotNull(ambient);

            using var consume = IngressActivity.StartConsume(
                "topic-a", MessagingSystems.Kafka, default);

            Assert.NotNull(consume);
            Assert.Equal(ambient.TraceId, consume.TraceId);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void StartConsume_WithAParentContext_JoinsThatTrace()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        try
        {
            using var source = new ActivitySource(TestSource);
            using var producer = source.StartActivity("publish");

            Assert.NotNull(producer);
            Assert.True(TraceContextPropagation.TryInject(producer, out var traceParent, out var traceState));

            var context = TraceContextPropagation.Extract(traceParent, traceState);

            using var consume = IngressActivity.StartConsume("topic-a", MessagingSystems.Kafka, context);

            Assert.NotNull(consume);
            Assert.Equal(producer.TraceId, consume.TraceId);
            Assert.Equal(producer.SpanId, consume.ParentSpanId);
            Assert.Equal(ActivityKind.Consumer, consume.Kind);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void StartConsume_WithADefaultParentContext_StartsItsOwnTrace()
    {
        // An old producer sends no header, so the consumer extracts default. That must not produce
        // a broken activity parented to an all-zero span.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        try
        {
            using var consume = IngressActivity.StartConsume(
                "topic-a", MessagingSystems.Kafka, default);

            Assert.NotNull(consume);
            Assert.NotEqual(default(ActivityTraceId), consume.TraceId);
            Assert.Equal(default(ActivitySpanId), consume.ParentSpanId);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    private static IDisposable ListeningSource(out ActivitySource source)
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        var created = new ActivitySource(TestSource);
        source = created;

        return new Cleanup(created);
    }

    private sealed class Cleanup(ActivitySource source) : IDisposable
    {
        public void Dispose()
        {
            source.Dispose();
            ActivityCorrelation.RemoveListener();
        }
    }
}
