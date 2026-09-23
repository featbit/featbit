using Api.RateLimiting;
using Api.Setup;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Domain.Usages;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Streaming.Insights;

namespace Api.Public;

[EnableRateLimiting(RateLimitingPolicies.Insight)]
public class InsightController : PublicApiControllerBase
{
    private readonly IMessageProducer _producer;
    private readonly MemoryCache _cache;
    private readonly MemoryCacheEntryOptions _cacheEntryOptions;
    private readonly IInsightsSettingCache _insightsSettingCache;
    private readonly InsightsMetrics _insightsMetrics;
    private readonly bool _filterByFlagSetting;
    private readonly ILogger<InsightController> _logger;

    public InsightController(
        IMessageProducer producer,
        BoundedMemoryCache boundedMemoryCache,
        IInsightsSettingCache insightsSettingCache,
        InsightsMetrics insightsMetrics,
        IOptions<InsightsOptions> insightsOptions,
        ILogger<InsightController> logger)
    {
        _producer = producer;
        _insightsSettingCache = insightsSettingCache;
        _insightsMetrics = insightsMetrics;
        _filterByFlagSetting = insightsOptions.Value.FilterByFlagSetting;
        _logger = logger;
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
        var validInsights = insights.Where(x => x != null && x.IsValid()).ToArray();
        if (validInsights.Length == 0)
        {
            return Ok();
        }

        var envIdString = EnvId.ToString();

        if (_filterByFlagSetting)
        {
            await _insightsSettingCache.EnsureLoadedAsync(EnvId);
        }

        List<string>? droppedFlagKeys = null;
        var endUserMessages = new List<EndUserMessage>(validInsights.Length);
        var insightMessages = new List<InsightMessage>(validInsights.Length);
        var usage = new InsightUsage(EnvId);
        foreach (var insight in validInsights)
        {
            // drop evaluations of flags with insights disabled before any end-user or usage bookkeeping,
            // so a fully dropped insight records nothing and does not mark its user as seen
            if (_filterByFlagSetting)
            {
                var filtered = insight!.FilterDisabledFlags(flagKey => _insightsSettingCache.IsDisabled(EnvId, flagKey));
                foreach (var flagKey in filtered.DroppedFlagKeys)
                {
                    _insightsMetrics.RecordDropped(EnvId, flagKey);
                    (droppedFlagKeys ??= []).Add(flagKey);
                }

                if (filtered.Skip)
                {
                    continue;
                }
            }

            var key = $"{envIdString}:{insight!.User!.KeyId}";
            if (!_cache.TryGetValue(key, out _))
            {
                _cache.Set(key, string.Empty, _cacheEntryOptions);
                endUserMessages.Add(insight.EndUserMessage(EnvId));
                usage.AddUser(insight.User!.KeyId);
            }

            insight.AppendInsightMessages(envIdString, insightMessages);
            usage.AddEvents(insight.Variations?.Length ?? 0, insight.Metrics?.Length ?? 0);
        }

        if (droppedFlagKeys is not null)
        {
            _logger.LogDebug(
                "Dropped {Count} evaluation insight(s) in env {EnvId} for flags with insights disabled: {FlagKeys}",
                droppedFlagKeys.Count, EnvId, string.Join(',', droppedFlagKeys.Distinct())
            );

            // every evaluation in the request was dropped: nothing to record, not even usage
            if (endUserMessages.Count == 0 && insightMessages.Count == 0)
            {
                return Ok();
            }
        }

        await Task.WhenAll(
            _producer.PublishBatchAsync(Topics.EndUser, endUserMessages),
            _producer.PublishBatchAsync(Topics.Insights, insightMessages),
            _producer.PublishAsync(Topics.Usage, usage)
        );

        return Ok();
    }
}
