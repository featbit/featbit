using System.Text;
using Application.Insights;
using Infrastructure.MQ;
using Microsoft.Extensions.Options;

namespace Infrastructure.UnitTests.MQ;

/// <summary>
/// Pins the byte accounting behind <c>buffer.bytes</c> for the insights ingest buffer.
/// </summary>
/// <remarks>
/// Byte occupancy is only affordable here because this handler already holds the serialized
/// message, so measuring it costs a byte count rather than a second serialization on the ingest
/// path. If the size argument is ever dropped from the call, the instrument keeps reporting — it
/// just reports zero forever, which reads as "this buffer holds no data" rather than as a defect.
/// These tests are what make that regression fail loudly instead.
/// </remarks>
public class InsightMessageHandlerTests
{
    private const string EnvId = "b1a2c3d4-0000-4000-8000-000000000001";

    private static string InsightJson(string flagKey)
    {
        var properties =
            $$"""{"featureFlagKey":"{{flagKey}}","userKeyId":"user-1","variationId":"v1","variationValue":"true"}""";

        // properties is a JSON *string* on the wire, so it has to be escaped into the envelope.
        var escaped = properties.Replace("\"", "\\\"");

        return $$"""
                 {"uuid":"6f8f2a1e-0000-4000-8000-000000000002","distinct_id":"user-1","env_id":"{{EnvId}}","event":"FlagValue","properties":"{{escaped}}","timestamp":1700000000000}
                 """;
    }

    private static InsightsTracker CreateTracker(int capacity = 16)
        => new(Options.Create(new InsightsTrackingOptions { ChannelCapacity = capacity }));

    [Fact]
    public async Task HandleAsync_WithAParseablePayload_SuppliesItsSizeToTheTracker()
    {
        var tracker = CreateTracker();
        var handler = new InsightMessageHandler(tracker);
        var message = InsightJson("flag-1");

        await handler.HandleAsync(message);

        Assert.Equal((long)Encoding.UTF8.GetByteCount(message), tracker.BufferedBytes);
    }

    /// <summary>
    /// The half that a naive implementation gets wrong: enqueue increments, so dequeue must
    /// decrement. Without it the gauge only ever climbs and reports a leak that is not happening.
    /// </summary>
    [Fact]
    public async Task TryRead_AfterOneInsightIsBuffered_ReleasesItsBytes()
    {
        var tracker = CreateTracker();
        var handler = new InsightMessageHandler(tracker);

        await handler.HandleAsync(InsightJson("flag-1"));
        Assert.True(tracker.BufferedBytes > 0);

        Assert.True(tracker.TryRead(out var insight));
        Assert.NotNull(insight);
        Assert.Equal(0L, tracker.BufferedBytes);
    }

    [Fact]
    public async Task TryRead_WithSeveralBufferedInsights_UnwindsTheirBytesInOrder()
    {
        var tracker = CreateTracker();
        var handler = new InsightMessageHandler(tracker);

        var first = InsightJson("flag-1");
        var second = InsightJson("a-much-longer-flag-key-than-the-first-one");

        await handler.HandleAsync(first);
        await handler.HandleAsync(second);

        var expected = (long)Encoding.UTF8.GetByteCount(first) + Encoding.UTF8.GetByteCount(second);
        Assert.Equal(expected, tracker.BufferedBytes);

        Assert.True(tracker.TryRead(out _));
        Assert.Equal((long)Encoding.UTF8.GetByteCount(second), tracker.BufferedBytes);

        Assert.True(tracker.TryRead(out _));
        Assert.Equal(0L, tracker.BufferedBytes);
    }

    /// <summary>
    /// A payload the parser rejects must not be buffered, and so must not be counted either.
    /// </summary>
    [Fact]
    public async Task HandleAsync_WithAnUnparseablePayload_BuffersNothingAndCountsNothing()
    {
        var tracker = CreateTracker();
        var handler = new InsightMessageHandler(tracker);

        await handler.HandleAsync("not json at all");

        Assert.Equal(0L, tracker.BufferedBytes);
        Assert.False(tracker.TryRead(out _));
    }
}
