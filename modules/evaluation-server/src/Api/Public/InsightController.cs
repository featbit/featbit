using Api.RateLimiting;
using Api.Setup;
using System.Diagnostics;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Domain.Observability;
using Domain.Usages;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Public;

[EnableRateLimiting(RateLimitingPolicies.Insight)]
public class InsightController : PublicApiControllerBase
{
    private readonly IMessageProducer _producer;
    private readonly MemoryCache _cache;
    private readonly MemoryCacheEntryOptions _cacheEntryOptions;

    public InsightController(IMessageProducer producer, BoundedMemoryCache boundedMemoryCache)
    {
        _producer = producer;
        _cache = boundedMemoryCache.Instance;
        _cacheEntryOptions = new MemoryCacheEntryOptions
        {
            Size = 1,
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(3)
        };
    }

    [HttpPost("track")]
    public async Task<IActionResult> TrackAsync(ICollection<Insight?> insights)
    {
        // T4 — the ingest half of the insights pipeline. The ASP.NET Core server span covers the
        // request; this covers the work inside it, which is where events are dropped and where the
        // fan-out to three topics happens.
        using var trace = TailSampledTrace.Start(
            TraceCategories.Insights, "insights.ingest", ActivityKind.Internal,
            SlowIngestThresholdMs);

        var validInsights = insights.Where(x => x != null && x.IsValid()).ToArray();

        // Recorded before the early return: an SDK sending nothing but malformed events still gets
        // a 200 OK, so without this the rejection is invisible from both ends of the pipe.
        var metrics = InsightsMetrics.Current;
        metrics.RecordReceived(Outcomes.Success, validInsights.Length);
        metrics.RecordReceived(Outcomes.Rejected, insights.Count - validInsights.Length);
        metrics.RecordRequestSize(Request.ContentLength);

        trace.SetTag("insights.received", insights.Count);
        trace.SetTag("insights.rejected", insights.Count - validInsights.Length);

        if (validInsights.Length == 0)
        {
            // Not a failure — the endpoint is behaving as designed — but worth retaining, because
            // an SDK whose events are all rejected looks healthy from every other angle.
            trace.Ended(Outcomes.Rejected, "all_invalid");
            return Ok();
        }

        var envId = EnvId;

        var endUserMessages = new List<EndUserMessage>();
        var insightMessages = new List<InsightMessage>();
        var usage = new InsightUsage(envId);
        foreach (var insight in validInsights)
        {
            var key = $"{envId:N}:{insight!.User!.KeyId}";
            if (!_cache.TryGetValue(key, out _))
            {
                _cache.Set(key, string.Empty, _cacheEntryOptions);
                endUserMessages.Add(insight.EndUserMessage(envId));
                usage.AddUser(insight.User!.KeyId);
            }

            insightMessages.AddRange(insight.InsightMessages(envId));
            usage.AddEvents(insight.Variations?.Length ?? 0, insight.Metrics?.Length ?? 0);
        }

        var tasks = endUserMessages.Select(x => _producer.PublishAsync(Topics.EndUser, x))
            .Concat(insightMessages.Select(x => _producer.PublishAsync(Topics.Insights, x)))
            .Append(_producer.PublishAsync(Topics.Usage, usage))
            .ToArray();

        await Task.WhenAll(tasks);

        trace.SetTag("insights.published", tasks.Length);
        trace.Success();

        return Ok();
    }

    /// <summary>
    /// Duration at or above which an ingest span is always retained. Ingestion is in-memory work
    /// plus a fan-out of fire-and-forget publishes, so two seconds means the transport is blocking.
    /// </summary>
    private const double SlowIngestThresholdMs = 2_000d;
}