using Application.ExperimentStats;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionExperimentStatsService(MongoDbClient mongoDb) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        var start = DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var envId = request.EnvId.ToString();

        var exposures = mongoDb.CollectionOf("ReleaseDecisionExposureEvents");
        var exposureFilter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("envId", envId),
            Builders<BsonDocument>.Filter.Eq("flagKey", request.FlagKey),
            Builders<BsonDocument>.Filter.Gte("exposedAt", start),
            Builders<BsonDocument>.Filter.Lt("exposedAt", end)
        );

        var exposureDocs = await exposures.Find(exposureFilter)
            .Sort(Builders<BsonDocument>.Sort.Ascending("exposedAt"))
            .ToListAsync();

        var firstEvaluations = exposureDocs
            .Select(ToReleaseDecisionExposure)
            .Where(x => !string.IsNullOrWhiteSpace(x.UserKey) && !string.IsNullOrWhiteSpace(x.Variant))
            .GroupBy(x => x.UserKey)
            .Select(x => x.First())
            .ToDictionary(x => x.UserKey);

        if (firstEvaluations.Count == 0)
        {
            return BuildResponse(request, []);
        }

        var metrics = mongoDb.CollectionOf("ReleaseDecisionMetricEvents");
        var metricFilter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("envId", envId),
            Builders<BsonDocument>.Filter.Eq("eventName", request.MetricEvent),
            Builders<BsonDocument>.Filter.Gte("occurredAt", start),
            Builders<BsonDocument>.Filter.Lt("occurredAt", end),
            Builders<BsonDocument>.Filter.In("userKey", firstEvaluations.Keys)
        );

        var metricDocs = await metrics.Find(metricFilter).ToListAsync();
        var userTotals = metricDocs
            .Select(ToReleaseDecisionMetric)
            .Where(x => firstEvaluations.TryGetValue(x.UserKey, out var fe) && x.Timestamp >= fe.Timestamp)
            .GroupBy(x => x.UserKey)
            .ToDictionary(
                x => x.Key,
                x => new UserTotal
                {
                    Count = x.LongCount(),
                    Sum = x.Sum(y => y.NumericValue),
                    Average = x.Average(y => y.NumericValue)
                }
            );

        var rows = firstEvaluations.Values
            .GroupBy(x => x.Variant)
            .Select(group =>
            {
                var contributions = group.Select(fe => GetContribution(
                    request.MetricType,
                    request.MetricAgg,
                    userTotals.TryGetValue(fe.UserKey, out var total) ? total : null
                )).ToArray();
                var users = group.LongCount();
                var conversions = group.LongCount(fe =>
                    userTotals.TryGetValue(fe.UserKey, out var total) && total.Count > 0);
                var sumValue = contributions.Sum();

                return new ExperimentVariantStatsVm
                {
                    Variant = group.Key,
                    Users = users,
                    Conversions = conversions,
                    SumValue = sumValue,
                    SumSquares = contributions.Sum(x => x * x),
                    ConversionRate = users == 0 ? 0 : (double)conversions / users,
                    AvgValue = users == 0 ? 0 : sumValue / users
                };
            })
            .OrderBy(x => x.Variant)
            .ToArray();

        return BuildResponse(request, rows);
    }

    private static ExperimentStatsVm BuildResponse(QueryExperimentStats request, IEnumerable<ExperimentVariantStatsVm> variants)
    {
        return new ExperimentStatsVm
        {
            EnvId = request.EnvId,
            FlagKey = request.FlagKey,
            MetricEvent = request.MetricEvent,
            Window = new ExperimentStatsWindowVm
            {
                Start = request.StartDate,
                End = request.EndDate
            },
            Variants = variants
        };
    }

    private static double GetContribution(string metricType, string metricAgg, UserTotal? userTotal)
    {
        var total = userTotal ?? new UserTotal();
        var normalizedAgg = metricType == "binary" ? "once" : metricAgg;

        return normalizedAgg switch
        {
            "once" => total.Count > 0 ? 1 : 0,
            "count" => total.Count,
            "sum" => total.Sum,
            "average" => total.Average,
            _ => throw new ArgumentException($"Unsupported metric aggregation: {metricAgg}", nameof(metricAgg))
        };
    }

    private static FlagEvaluation ToReleaseDecisionExposure(BsonDocument doc)
    {
        var variationId = doc.GetValue("variationId", string.Empty);

        return new FlagEvaluation
        {
            UserKey = doc.GetValue("userKey", string.Empty).AsString,
            Variant = variationId.AsString,
            Timestamp = doc.GetValue("exposedAt").ToUniversalTime()
        };
    }

    private static MetricEvent ToReleaseDecisionMetric(BsonDocument doc)
    {
        return new MetricEvent
        {
            UserKey = doc.GetValue("userKey", string.Empty).AsString,
            NumericValue = doc.GetValue("numericValue", 0).ToDouble(),
            Timestamp = doc.GetValue("occurredAt").ToUniversalTime()
        };
    }

    private sealed record FlagEvaluation
    {
        public string UserKey { get; init; } = string.Empty;
        public string Variant { get; init; } = string.Empty;
        public DateTime Timestamp { get; init; }
    }

    private sealed record MetricEvent
    {
        public string UserKey { get; init; } = string.Empty;
        public double NumericValue { get; init; }
        public DateTime Timestamp { get; init; }
    }

    private sealed record UserTotal
    {
        public long Count { get; init; }
        public double Sum { get; init; }
        public double Average { get; init; }
    }
}
