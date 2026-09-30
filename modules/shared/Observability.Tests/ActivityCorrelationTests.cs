using System.Diagnostics;
using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Correlation exists so that log records can be joined together. These tests assert the property
/// the rest of the estate depends on: that a trace identifier is available whenever work is being
/// done, and is absent — rather than zero-valued — when it is not.
/// </summary>
public sealed class ActivityCorrelationTests
{
    private const string TestSource = "FeatBit.Tests.Correlation";

    [Fact]
    public void EnsureListener_CalledTwice_IsIdempotent()
    {
        ActivityCorrelation.RemoveListener();
        try
        {
            ActivityCorrelation.EnsureListener();
            ActivityCorrelation.EnsureListener();
            ActivityCorrelation.EnsureListener();

            Assert.True(ActivityCorrelation.IsListenerRegistered);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void StartActivity_WithoutAListener_CreatesNoActivity()
    {
        // The premise of the whole design: with nothing listening, StartActivity returns null and
        // there is no trace id to log. This is the state the codebase was in before.
        ActivityCorrelation.RemoveListener();

        using var source = new ActivitySource(TestSource);
        using var activity = source.StartActivity("work");

        Assert.Null(activity);
        Assert.Null(ActivityCorrelation.TraceId);
    }

    [Fact]
    public void StartActivity_WithAListener_CarriesTraceAndSpanIds()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);
            using var activity = source.StartActivity("work");

            Assert.NotNull(activity);

            var traceId = ActivityCorrelation.TraceId;
            var spanId = ActivityCorrelation.SpanId;

            Assert.NotNull(traceId);
            Assert.NotNull(spanId);
            Assert.Equal(32, traceId!.Length);
            Assert.Equal(16, spanId!.Length);
            Assert.Equal(traceId.ToLowerInvariant(), traceId);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void StartActivity_WithAListener_DoesNotRecordTheActivity()
    {
        // Propagation-only sampling: identifiers exist, but no data is collected. That is what makes
        // always-on correlation affordable on hot paths.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);
            using var activity = source.StartActivity("work");

            Assert.NotNull(activity);
            Assert.False(activity!.IsAllDataRequested);
            Assert.False(activity.Recorded);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void StartActivity_WhenNested_SharesOneTraceId()
    {
        // Stages within a service must join up: that is the entire diagnostic value delivered before
        // trace context is carried across service boundaries.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);

            using var outer = source.StartActivity("outer");
            var outerTrace = ActivityCorrelation.TraceId;
            var outerSpan = ActivityCorrelation.SpanId;

            Assert.NotNull(outerTrace);

            using (source.StartActivity("inner"))
            {
                Assert.Equal(outerTrace, ActivityCorrelation.TraceId);
                Assert.NotEqual(outerSpan, ActivityCorrelation.SpanId);
            }

            Assert.Equal(outerSpan, ActivityCorrelation.SpanId);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void TraceIdOf_ReturnsNull_ForUnstartedActivity()
    {
        // An all-zero trace id reads as a real value in a log field. Returning null instead keeps
        // "no correlation available" distinguishable from "correlated to trace 000…0".
        var activity = new Activity("never-started");

        Assert.Null(ActivityCorrelation.TraceIdOf(activity));
        Assert.Null(ActivityCorrelation.SpanIdOf(activity));
    }

    [Fact]
    public void TraceIdOf_ReturnsNull_ForNull()
    {
        Assert.Null(ActivityCorrelation.TraceIdOf(null));
        Assert.Null(ActivityCorrelation.SpanIdOf(null));
    }

    [Theory]
    [InlineData("FeatBit.Api", true)]
    [InlineData("FeatBit.EvaluationServer", true)]
    [InlineData("FeatBit.ControlPlane", true)]
    [InlineData("Microsoft.AspNetCore", true)]
    [InlineData("Microsoft.AspNetCore.Hosting", true)]
    [InlineData("Npgsql", false)]
    [InlineData("StackExchange.Redis", false)]
    [InlineData("System.Net.Http", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void ShouldListenTo_ForAnySourceName_CoversFeatBitAndAspNetCoreOnly(string? sourceName, bool expected)
    {
        // Scope is deliberately narrow: listening to database and HTTP client sources would switch
        // on activity creation inside hot-path libraries, for no correlation benefit the
        // request-level activity does not already provide.
        Assert.Equal(expected, ActivityCorrelation.ShouldListenTo(sourceName));
    }

    [Fact]
    public void SetChangeId_OnAParentActivity_IsReadableFromANestedActivity()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);
            using var outer = source.StartActivity("handle-change");

            ActivityCorrelation.SetChangeId("abc123");
            Assert.Equal("abc123", ActivityCorrelation.CurrentChangeId);

            // Baggage flows to children, so a later stage reads it without being passed it.
            using (source.StartActivity("publish"))
            {
                Assert.Equal("abc123", ActivityCorrelation.CurrentChangeId);
            }

            Assert.Equal("abc123", outer!.GetTagItem(CorrelationFields.ChangeId));
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void SetChangeId_IsANoOp_WhenNoActivityIsInScope()
    {
        ActivityCorrelation.RemoveListener();

        var activity = ActivityCorrelation.SetChangeId("abc123");

        Assert.Null(activity);
        Assert.Null(ActivityCorrelation.CurrentChangeId);
    }
}
