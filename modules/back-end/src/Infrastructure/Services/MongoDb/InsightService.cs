using Application.FeatureFlags;
using Application.Insights;
using Domain.Experiments;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class InsightService(MongoDbClient mongoDb) : IInsightService
{
    private static readonly InsertManyOptions InsertOptions = new()
    {
        BypassDocumentValidation = true,
        IsOrdered = false
    };

    public async Task AddManyAsync(object[] insights)
    {
        var exposures = insights.OfType<ExperimentExposureEvent>().ToArray();
        if (exposures.Length > 0)
        {
            await mongoDb.CollectionOf<ExperimentExposureEvent>().InsertManyAsync(exposures, InsertOptions);
        }

        var metrics = insights.OfType<ExperimentMetricEvent>().ToArray();
        if (metrics.Length > 0)
        {
            await mongoDb.CollectionOf<ExperimentMetricEvent>().InsertManyAsync(metrics, InsertOptions);
        }
    }

    public async Task<ICollection<Insight>> GetInsightsAsync(Guid envId, InsightFilter filter)
    {
        var start = DateTimeOffset.FromUnixTimeMilliseconds(filter.From).UtcDateTime;
        var end = DateTimeOffset.FromUnixTimeMilliseconds(filter.To).UtcDateTime;

        var docs = await mongoDb.CollectionOf<ExperimentExposureEvent>()
            .Find(x =>
                x.EnvId == envId &&
                x.FlagKey == filter.FeatureFlagKey &&
                x.ExposedAt >= start &&
                x.ExposedAt <= end &&
                x.VariationId != null)
            .ToListAsync();

        return docs
            .Select(doc => new
            {
                Bucket = Truncate(doc.ExposedAt, filter.IntervalType),
                doc.VariationId
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.VariationId))
            .GroupBy(x => x.Bucket)
            .OrderBy(x => x.Key)
            .Select(group => new Insight
            {
                Time = group.Key.ToString("O"),
                Variations = group
                    .GroupBy(x => x.VariationId)
                    .Select(x => new VariationInsights { Id = x.Key, Val = x.Count() })
                    .ToArray()
            })
            .ToArray();
    }

    private static DateTime Truncate(DateTime timestamp, string intervalType)
    {
        var utc = timestamp.Kind == DateTimeKind.Utc ? timestamp : timestamp.ToUniversalTime();

        return intervalType switch
        {
            IntervalType.Month => new DateTime(utc.Year, utc.Month, 1, 0, 0, 0, DateTimeKind.Utc),
            IntervalType.Week => StartOfWeek(utc),
            IntervalType.Day => new DateTime(utc.Year, utc.Month, utc.Day, 0, 0, 0, DateTimeKind.Utc),
            IntervalType.Hour => new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, DateTimeKind.Utc),
            IntervalType.Minute => new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, utc.Minute, 0, DateTimeKind.Utc),
            _ => throw new ArgumentException($"Unsupported interval type: {intervalType}", nameof(intervalType))
        };
    }

    private static DateTime StartOfWeek(DateTime utc)
    {
        var daysSinceMonday = ((int)utc.DayOfWeek + 6) % 7;
        var monday = utc.Date.AddDays(-daysSinceMonday);
        return DateTime.SpecifyKind(monday, DateTimeKind.Utc);
    }
}
