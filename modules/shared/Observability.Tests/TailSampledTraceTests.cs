using System.Diagnostics;
using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// The tail-sampling span scope shared by T3, T4, T5, and the messaging publish spans.
/// </summary>
/// <remarks>
/// The retention rule is the whole point of the type, so these tests are almost entirely about
/// which spans survive sampling rather than about which tags they carry.
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class TailSampledTraceTests : IDisposable
{
    private const string Category = TraceCategories.Sync;
    private const string SpanName = "tail.sampled.probe";

    private readonly TraceGate _originalGate = TraceGate.Current;

    public void Dispose() => TraceGate.SetCurrent(_originalGate);

    /// <summary>
    /// Custom traces are off by default, and a disabled category must not create a span at all —
    /// not an unrecorded one. Anything else puts allocation on paths that are hot enough to notice.
    /// </summary>
    [Fact]
    public void Start_WithADisabledCategory_CreatesNoSpan()
    {
        TraceGate.SetCurrent(TraceGate.Disabled);

        using var listener = Listen(out var finished);
        using (var trace = TailSampledTrace.Start(
                   Category, SpanName, ActivityKind.Internal, slowThresholdMs: 1))
        {
            Assert.False(trace.IsRecording);
            trace.Success();
        }

        Assert.Empty(finished);
    }

    /// <summary>
    /// <b>The rule that makes tail sampling worth having.</b> With the ratio at zero, a healthy span
    /// is dropped but a failed one is still retained — because whether it failed is not knowable
    /// when the span starts, and head sampling would therefore throw away precisely the spans an
    /// investigation needs.
    /// </summary>
    [Fact]
    public void Dispose_WithAFailedSpan_RetainsItEvenAtAZeroSampleRatio()
    {
        TraceGate.SetCurrent(new TraceGate([Category], sampleRatio: 0d));

        using var listener = Listen(out var finished);

        using (var success = TailSampledTrace.Start(
                   Category, SpanName, ActivityKind.Internal, slowThresholdMs: 60_000))
        {
            success.Success();
        }

        using (var failure = TailSampledTrace.Start(
                   Category, SpanName, ActivityKind.Internal, slowThresholdMs: 60_000))
        {
            failure.Failed(new TimeoutException());
        }

        var retained = finished
            .Where(a => a.ActivityTraceFlags.HasFlag(ActivityTraceFlags.Recorded))
            .ToArray();

        var only = Assert.Single(retained);
        Assert.Equal(ActivityStatusCode.Error, only.Status);
        Assert.Equal(nameof(TimeoutException), only.GetTagItem(ObservabilityTags.ErrorType));
    }

    /// <summary>
    /// A slow span is retained on the same argument as a failed one: the latency outlier is the
    /// reason anybody opened the trace backend, and it cannot be identified in advance.
    /// </summary>
    [Fact]
    public void Dispose_WithASlowSpan_RetainsItEvenAtAZeroSampleRatio()
    {
        TraceGate.SetCurrent(new TraceGate([Category], sampleRatio: 0d));

        using var listener = Listen(out var finished);
        using (var trace = TailSampledTrace.Start(
                   Category, SpanName, ActivityKind.Internal, slowThresholdMs: 0d))
        {
            trace.Success();
        }

        var only = Assert.Single(finished);
        Assert.True(only.ActivityTraceFlags.HasFlag(ActivityTraceFlags.Recorded));
        Assert.Equal(ActivityStatusCode.Ok, only.Status);
    }

    [Fact]
    public void Dispose_WithASuccessfulFastSpan_RetainsItWhenTheRatioAllows()
    {
        TraceGate.SetCurrent(new TraceGate([Category], sampleRatio: 1d));

        using var listener = Listen(out var finished);
        using (var trace = TailSampledTrace.Start(
                   Category, SpanName, ActivityKind.Internal, slowThresholdMs: 60_000))
        {
            trace.SetTag(ObservabilityTags.Operation, "probe");
            trace.Success();
        }

        var only = Assert.Single(finished);
        Assert.True(only.ActivityTraceFlags.HasFlag(ActivityTraceFlags.Recorded));
        Assert.Equal("probe", only.GetTagItem(ObservabilityTags.Operation));
        Assert.Equal(Outcomes.Success, only.GetTagItem(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// Enabling one category must not enable another. Categories exist so that turning on flag-change
    /// tracing during an incident does not also switch on a span for every message published.
    /// </summary>
    [Fact]
    public void Start_WithOneCategoryEnabled_DoesNotEnableAnother()
    {
        TraceGate.SetCurrent(new TraceGate([TraceCategories.Insights], sampleRatio: 1d));

        using var listener = Listen(out var finished);
        using (var trace = TailSampledTrace.Start(
                   TraceCategories.Messaging, SpanName, ActivityKind.Producer, slowThresholdMs: 1))
        {
            trace.Success();
        }

        Assert.Empty(finished);
    }

    /// <summary>
    /// Disposing twice must not end the span twice. The scope is a struct passed by value in a few
    /// places, so a double dispose is a plausible accident rather than a hypothetical one.
    /// </summary>
    [Fact]
    public void Dispose_CalledTwice_EndsTheSpanOnce()
    {
        TraceGate.SetCurrent(new TraceGate([Category], sampleRatio: 1d));

        using var listener = Listen(out var finished);

        var trace = TailSampledTrace.Start(
            Category, SpanName, ActivityKind.Internal, slowThresholdMs: 60_000);
        trace.Success();
        trace.Dispose();
        trace.Dispose();

        Assert.Single(finished);
    }

    [Fact]
    public void Ended_WithAnOutcomeAndReason_RecordsBoth()
    {
        TraceGate.SetCurrent(new TraceGate([Category], sampleRatio: 1d));

        using var listener = Listen(out var finished);
        using (var trace = TailSampledTrace.Start(
                   Category, SpanName, ActivityKind.Internal, slowThresholdMs: 60_000))
        {
            trace.Ended(Outcomes.Rejected, "all_invalid");
        }

        var only = Assert.Single(finished);

        Assert.Equal(Outcomes.Rejected, only.GetTagItem(ObservabilityTags.Outcome));
        Assert.Equal("all_invalid", only.GetTagItem(ObservabilityTags.Reason));

        // Not Ok: a rejection is not a success, and folding it into Ok would hide it from every
        // "show me the failed spans" query a backend offers.
        Assert.Equal(ActivityStatusCode.Error, only.Status);
    }

    /// <summary>
    /// Registers a listener that records every finished activity from the FeatBit source.
    /// </summary>
    /// <remarks>
    /// The source name is hoisted into a local before the listener is registered. Reading
    /// <c>FeatBitActivitySources.Service</c> inside <c>ShouldListenTo</c> re-enters that type's
    /// initializer while it is still constructing its <see cref="ActivitySource"/>, which throws a
    /// <see cref="TypeInitializationException"/> that then poisons the type for the whole process.
    /// </remarks>
    private static ActivityListener Listen(out List<Activity> finished)
    {
        var captured = new List<Activity>();
        finished = captured;

        var sourceName = FeatBitActivitySources.Service.Name;

        var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == sourceName,
            Sample = (ref ActivityCreationOptions<ActivityContext> _)
                => ActivitySamplingResult.AllData,
            ActivityStopped = activity =>
            {
                if (activity.OperationName == SpanName)
                {
                    captured.Add(activity);
                }
            }
        };

        ActivitySource.AddActivityListener(listener);

        return listener;
    }
}
