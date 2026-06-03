using Application.ExperimentStats;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ExperimentStatsService(MongoDbClient mongoDb) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        var start = DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var events = mongoDb.CollectionOf("Events");
        var envId = request.EnvId.ToString();
        var flagExptId = $"{request.EnvId}-{request.FlagKey}";

        var flagFilter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("env_id", envId),
            Builders<BsonDocument>.Filter.Eq("distinct_id", flagExptId),
            Builders<BsonDocument>.Filter.Eq("event", "FlagValue"),
            Builders<BsonDocument>.Filter.Gte("timestamp", start),
            Builders<BsonDocument>.Filter.Lt("timestamp", end),
            Builders<BsonDocument>.Filter.Eq("properties.tag_2", "true")
        );

        var flagDocs = await events.Find(flagFilter)
            .Sort(Builders<BsonDocument>.Sort.Ascending("timestamp"))
            .ToListAsync();

        var firstEvaluations = flagDocs
            .Select(ToFlagEvaluation)
            .Where(x => !string.IsNullOrWhiteSpace(x.UserKey) && !string.IsNullOrWhiteSpace(x.Variant))
            .GroupBy(x => x.UserKey)
            .Select(x => x.First())
            .ToDictionary(x => x.UserKey);

        if (firstEvaluations.Count == 0)
        {
            return BuildResponse(request, []);
        }

        var metricFilter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("env_id", envId),
            Builders<BsonDocument>.Filter.Eq("distinct_id", request.MetricEvent),
            Builders<BsonDocument>.Filter.Gte("timestamp", start),
            Builders<BsonDocument>.Filter.Lt("timestamp", end),
            Builders<BsonDocument>.Filter.In("properties.tag_0", firstEvaluations.Keys)
        );

        var metricDocs = await events.Find(metricFilter).ToListAsync();
        var userTotals = metricDocs
            .Select(ToMetricEvent)
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

    private static FlagEvaluation ToFlagEvaluation(BsonDocument doc)
    {
        var properties = doc.GetValue("properties", new BsonDocument()).AsBsonDocument;

        return new FlagEvaluation
        {
            UserKey = properties.GetValue("tag_0", string.Empty).AsString,
            Variant = properties.GetValue("tag_1", string.Empty).AsString,
            Timestamp = doc.GetValue("timestamp").ToUniversalTime()
        };
    }

    private static MetricEvent ToMetricEvent(BsonDocument doc)
    {
        var properties = doc.GetValue("properties", new BsonDocument()).AsBsonDocument;

        return new MetricEvent
        {
            UserKey = properties.GetValue("tag_0", string.Empty).AsString,
            NumericValue = GetNumericValue(properties),
            Timestamp = doc.GetValue("timestamp").ToUniversalTime()
        };
    }

    private static double GetNumericValue(BsonDocument properties)
    {
        if (properties.TryGetValue("numericValue", out var numericValue) && numericValue.IsNumeric)
        {
            return numericValue.ToDouble();
        }

        if (properties.TryGetValue("tag_1", out var tagValue) &&
            double.TryParse(tagValue.ToString(), out var parsed))
        {
            return parsed;
        }

        return 0;
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
