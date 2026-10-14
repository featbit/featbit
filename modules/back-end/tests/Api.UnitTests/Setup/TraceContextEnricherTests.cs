using System.Diagnostics;
using Api.Setup;
using Domain.Observability;
using Serilog.Core;
using Serilog.Events;
using Serilog.Parsing;

namespace Api.UnitTests.Setup;

/// <summary>
/// The enricher is what makes correlation visible where operators actually look. These tests assert
/// the fields land on the log event itself — not on a particular sink — and that a missing value is
/// omitted rather than written as an empty or all-zero string.
/// </summary>
[Collection(ActivityCorrelationCollection.Name)]
public class TraceContextEnricherTests
{
    private const string TestSource = "FeatBit.Tests.Enricher";

    [Fact]
    public void Enrich_AddsTraceAndSpanIds_WhenAnActivityIsInScope()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);
            using var activity = source.StartActivity("request");
            Assert.NotNull(activity);

            var logEvent = Enrich();

            Assert.Equal(
                ActivityCorrelation.TraceIdOf(activity),
                Value(logEvent, CorrelationFields.TraceId));
            Assert.Equal(
                ActivityCorrelation.SpanIdOf(activity),
                Value(logEvent, CorrelationFields.SpanId));
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void Enrich_AddsChangeId_WhenOneIsInScope()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);
            using var activity = source.StartActivity("handle-change");
            ActivityCorrelation.SetChangeId("deadbeefdeadbeef");

            var logEvent = Enrich();

            Assert.Equal("deadbeefdeadbeef", Value(logEvent, CorrelationFields.ChangeId));
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void Enrich_OmitsChangeId_WhenNoneIsInScope()
    {
        // A change identifier only exists on flag/segment paths. Writing an empty one on every other
        // log record would make "no change in scope" indistinguishable from a lost value.
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);
            using var activity = source.StartActivity("request");

            var logEvent = Enrich();

            Assert.DoesNotContain(CorrelationFields.ChangeId, logEvent.Properties.Keys);
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    [Fact]
    public void Enrich_AddsNothing_WhenNoActivityIsInScope()
    {
        // Startup and background work with no activity must not be tagged with an all-zero trace id,
        // which reads as a real value when querying logs.
        ActivityCorrelation.RemoveListener();

        var logEvent = Enrich();

        Assert.DoesNotContain(CorrelationFields.TraceId, logEvent.Properties.Keys);
        Assert.DoesNotContain(CorrelationFields.SpanId, logEvent.Properties.Keys);
        Assert.DoesNotContain(CorrelationFields.ChangeId, logEvent.Properties.Keys);
    }

    [Fact]
    public void Enrich_WhenThePropertyAlreadyExists_DoesNotOverwriteIt()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();
        try
        {
            using var source = new ActivitySource(TestSource);
            using var activity = source.StartActivity("request");

            var logEvent = NewLogEvent();
            logEvent.AddPropertyIfAbsent(
                new LogEventProperty(CorrelationFields.TraceId, new ScalarValue("already-set")));

            new TraceContextEnricher().Enrich(logEvent, new PropertyFactory());

            Assert.Equal("already-set", Value(logEvent, CorrelationFields.TraceId));
        }
        finally
        {
            ActivityCorrelation.RemoveListener();
        }
    }

    private static LogEvent Enrich()
    {
        var logEvent = NewLogEvent();
        new TraceContextEnricher().Enrich(logEvent, new PropertyFactory());
        return logEvent;
    }

    private static LogEvent NewLogEvent() => new(
        DateTimeOffset.UtcNow,
        LogEventLevel.Information,
        exception: null,
        new MessageTemplate("test", []),
        []);

    private static string? Value(LogEvent logEvent, string name)
        => logEvent.Properties.TryGetValue(name, out var property) && property is ScalarValue scalar
            ? scalar.Value as string
            : null;

    private sealed class PropertyFactory : ILogEventPropertyFactory
    {
        public LogEventProperty CreateProperty(string name, object? value, bool destructureObjects = false)
            => new(name, new ScalarValue(value));
    }
}
