using System.Diagnostics;
using System.Text.Json;
using Domain.Observability;

namespace FeatBit.Observability.Tests;

/// <summary>
/// Redis has no header concept, so trace context rides inside the payload. That makes these tests
/// load-bearing in a way the Kafka ones are not: a defect here does not merely lose a trace join,
/// it corrupts a message and stops flag propagation. The properties asserted are therefore mostly
/// about what <see cref="JsonTraceContext"/> must <i>not</i> do — never produce invalid JSON, never
/// disturb an existing property, and never throw on a payload it does not recognize.
/// </summary>
[Collection(ObservabilityCollection.Name)]
public sealed class JsonTraceContextTests
{
    private const string TestSource = "FeatBit.Tests.JsonTraceContext";

    // Mirrors the ReusableJsonSerializerOptions.Web that both modules' producers serialize with.
    // Duplicated rather than referenced because shared/Observability is deliberately BCL-only and
    // that type lives in each module's own Domain project.
    private static readonly JsonSerializerOptions WebOptions = new(JsonSerializerDefaults.Web);

    private sealed record FlagChange(string Id, string EnvId);

    [Fact]
    public void Inject_WithNoActivity_ReturnsThePayloadUnchanged()
    {
        // Nothing is listening in a process with no exporter, so this is the common case, not an
        // edge case. The published bytes must be identical to what a producer predating this wrote.
        const string payload = """{"id":"flag-1","envId":"env-1"}""";

        var injected = JsonTraceContext.Inject(payload, activity: null);

        Assert.Same(payload, injected);
    }

    [Fact]
    public void Inject_WithAnActivity_AddsTheTraceContextAlongsideTheExistingProperties()
    {
        // Arrange
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        const string payload = """{"id":"flag-1","envId":"env-1"}""";

        // Act
        var injected = JsonTraceContext.Inject(payload, activity);

        // Assert — the original properties survive and the result is still valid JSON.
        using var document = JsonDocument.Parse(injected);
        var root = document.RootElement;

        Assert.Equal("flag-1", root.GetProperty("id").GetString());
        Assert.Equal("env-1", root.GetProperty("envId").GetString());
        Assert.Equal(activity.Id, root.GetProperty(JsonTraceContext.TraceParentProperty).GetString());
    }

    [Fact]
    public void Inject_WithNoTraceState_OmitsTheTraceStateProperty()
    {
        // An absent tracestate must be absent, not an empty string: ActivityContext.TryParse treats
        // the two differently and an empty vendor state is not a thing the W3C format has.
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        var injected = JsonTraceContext.Inject("""{"id":"flag-1"}""", activity);

        using var document = JsonDocument.Parse(injected);

        Assert.False(document.RootElement.TryGetProperty(JsonTraceContext.TraceStateProperty, out _));
    }

    [Fact]
    public void Inject_WithATraceStateNeedingEscaping_ProducesValidJson()
    {
        // tracestate carries vendor content that reached this process from somewhere else, so it is
        // the one value here that is not ours to trust. Appending it raw would let an upstream
        // quote character terminate the string and corrupt every message on the topic.
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        activity.TraceStateString = """vendor="a,b",other=\c""";

        var injected = JsonTraceContext.Inject("""{"id":"flag-1"}""", activity);

        using var document = JsonDocument.Parse(injected);

        Assert.Equal(
            activity.TraceStateString,
            document.RootElement.GetProperty(JsonTraceContext.TraceStateProperty).GetString());
        Assert.Equal("flag-1", document.RootElement.GetProperty("id").GetString());
    }

    [Fact]
    public void Inject_IntoAnEmptyObject_DoesNotEmitATrailingComma()
    {
        // "{}" is the one payload shape where appending a separator produces invalid JSON. Control
        // plane secret messages can serialize to an object with no properties.
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        var injected = JsonTraceContext.Inject("{}", activity);

        using var document = JsonDocument.Parse(injected);

        Assert.Equal(JsonValueKind.Object, document.RootElement.ValueKind);
        Assert.Equal(activity.Id, document.RootElement.GetProperty(JsonTraceContext.TraceParentProperty).GetString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("[1,2,3]")]
    [InlineData("\"a bare string\"")]
    [InlineData("42")]
    [InlineData("null")]
    public void Inject_IntoANonObjectPayload_ReturnsItUnchanged(string payload)
    {
        // There is nowhere to put a sibling property, so the trace join is lost for that message.
        // Losing a join is acceptable; rewriting a caller's payload into something its handler
        // cannot read is not.
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        Assert.Equal(payload, JsonTraceContext.Inject(payload, activity));
    }

    [Fact]
    public void Inject_WhenThePayloadAlreadyCarriesATraceParent_LeavesItAlone()
    {
        // Writing a second one produces a duplicate key, and which of the two a reader wins with is
        // not defined by the JSON spec.
        using var cleanup = ListeningSource(out var source);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        const string existing = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
        var payload = $$"""{"traceparent":"{{existing}}","id":"flag-1"}""";

        var injected = JsonTraceContext.Inject(payload, activity);

        Assert.Same(payload, injected);
        using var document = JsonDocument.Parse(injected);
        Assert.Equal(existing, document.RootElement.GetProperty(JsonTraceContext.TraceParentProperty).GetString());
    }

    [Fact]
    public void InjectThenExtract_ContinuesTheProducersTrace()
    {
        // The property the whole change exists for.
        using var cleanup = ListeningSource(out var source);
        using var producer = source.StartActivity("publish");
        Assert.NotNull(producer);

        var injected = JsonTraceContext.Inject("""{"id":"flag-1"}""", producer);

        var context = JsonTraceContext.Extract(injected);

        Assert.Equal(producer.TraceId, context.TraceId);
        Assert.Equal(producer.SpanId, context.SpanId);
        Assert.True(context.IsRemote);
    }

    [Fact]
    public void Extract_FromAPayloadWrittenByAnOlderProducer_YieldsNoParent()
    {
        // Backward compatibility: a message already on the queue when this ships carries no trace
        // context, and must consume exactly as it did before — as its own root trace.
        var context = JsonTraceContext.Extract("""{"id":"flag-1","envId":"env-1"}""");

        Assert.Equal(default(ActivityContext), context);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("""{"traceparent":"not-a-traceparent"}""")]
    [InlineData("""{"traceparent":123}""")]
    [InlineData("""{"traceparent":null}""")]
    [InlineData("""["traceparent"]""")]
    [InlineData("""{"traceparent":"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" """)]
    public void Extract_FromAnAbsentOrMalformedPayload_YieldsNoParent(string? payload)
    {
        // This runs on the consume path for every message, so every one of these must degrade to a
        // fresh trace rather than throw. The last case is deliberately truncated JSON: the fast
        // path finds the property name and hands a payload to the parser that cannot be parsed.
        var context = JsonTraceContext.Extract(payload);

        Assert.Equal(default(ActivityContext), context);
    }

    [Fact]
    public void Inject_ThenDeserializeWithoutKnowingAboutTraceContext_StillBindsTheMessage()
    {
        // The compatibility claim that makes this safe to roll out in any order, asserted rather
        // than assumed: a consumer that has never heard of these properties binds the message
        // exactly as before, because System.Text.Json ignores unknown properties unless a type
        // opts into JsonUnmappedMemberHandling.Disallow — and nothing in the estate does.
        using var cleanup = ListeningSource(out var source);
        using var producer = source.StartActivity("publish");
        Assert.NotNull(producer);

        var payload = JsonSerializer.Serialize(new FlagChange("flag-1", "env-1"), WebOptions);

        var injected = JsonTraceContext.Inject(payload, producer);

        var roundTripped = JsonSerializer.Deserialize<FlagChange>(injected, WebOptions);

        Assert.NotNull(roundTripped);
        Assert.Equal("flag-1", roundTripped.Id);
        Assert.Equal("env-1", roundTripped.EnvId);
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
