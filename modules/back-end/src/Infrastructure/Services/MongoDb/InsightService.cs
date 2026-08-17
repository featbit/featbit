using Application.FeatureFlags;
using Application.Insights;
using Domain.Experiments;
using MongoDB.Bson;
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

        var unit = filter.IntervalType switch
        {
            IntervalType.Month => "month",
            IntervalType.Week => "week",
            IntervalType.Day => "day",
            IntervalType.Hour => "hour",
            IntervalType.Minute => "minute",

            _ => throw new ArgumentException($"Unsupported interval type: {filter.IntervalType}",
                nameof(filter.IntervalType))
        };

        var dateTrunc = new BsonDocument
        {
            { "date", "$exposedAt" },
            { "unit", unit },
            { "timezone", "UTC" }
        };

        if (filter.IntervalType == IntervalType.Week)
        {
            dateTrunc.Add("startOfWeek", "monday");
        }

        PipelineDefinition<ExperimentExposureEvent, BsonDocument> pipeline = new BsonDocument[]
        {
            new("$match", new BsonDocument
            {
                { "envId", new BsonBinaryData(envId, GuidRepresentation.Standard) },
                { "flagKey", filter.FeatureFlagKey },
                { "exposedAt", new BsonDocument { { "$gte", start }, { "$lte", end } } },
                { "variationId", new BsonDocument { { "$type", "string" }, { "$regex", "\\S" } } }
            }),
            new("$group", new BsonDocument
            {
                {
                    "_id",
                    new BsonDocument
                    {
                        { "bucket", new BsonDocument("$dateTrunc", dateTrunc) },
                        { "variationId", "$variationId" }
                    }
                },
                { "count", new BsonDocument("$sum", 1) }
            }),
            new("$sort", new BsonDocument
            {
                { "_id.bucket", 1 },
                { "_id.variationId", 1 }
            }),
            new("$group", new BsonDocument
            {
                { "_id", "$_id.bucket" },
                {
                    "variations",
                    new BsonDocument("$push", new BsonDocument
                    {
                        { "id", "$_id.variationId" },
                        { "val", "$count" }
                    })
                }
            }),
            new("$sort", new BsonDocument("_id", 1))
        };

        var docs = await mongoDb.CollectionOf<ExperimentExposureEvent>()
            .Aggregate(pipeline)
            .ToListAsync();

        return docs.Select(doc => new Insight
        {
            Time = doc["_id"].ToUniversalTime().ToString("O"),
            Variations = doc["variations"].AsBsonArray
                .Select(x => x.AsBsonDocument)
                .Select(x => new VariationInsights
                {
                    Id = x["id"].AsString,
                    Val = x["val"].ToInt32()
                })
                .ToArray()
        }).ToArray();
    }
}
