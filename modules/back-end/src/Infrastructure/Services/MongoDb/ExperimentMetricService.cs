using System.Text.RegularExpressions;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Experiments.ExperimentMetrics;
using Application.Services;
using Domain.Experiments;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ExperimentMetricService(MongoDbClient mongoDb) : IExperimentMetricService
{
    public async Task<PagedResult<ExperimentMetric>> GetListAsync(
        Guid envId,
        ExperimentMetricFilter filter,
        IReadOnlyCollection<string> referencedKeys)
    {
        referencedKeys ??= [];

        filter ??= new ExperimentMetricFilter();
        var builder = Builders<ExperimentMetric>.Filter;
        var filters = new List<FilterDefinition<ExperimentMetric>>
        {
            builder.Eq(x => x.FeatBitEnvId, envId)
        };

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
        {
            var search = new BsonRegularExpression(Regex.Escape(filter.SearchText.Trim()), "i");
            var searchFilters = new List<FilterDefinition<ExperimentMetric>>
            {
                builder.Regex(x => x.Name, search),
                builder.Regex(x => x.Key, search),
            };
            if (referencedKeys.Count > 0)
            {
                searchFilters.Add(builder.In(x => x.Key, referencedKeys));
            }

            filters.Add(builder.Or(searchFilters));
        }

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            filters.Add(builder.Regex(x => x.Name, new BsonRegularExpression(filter.Name, "i")));
        }

        if (!string.IsNullOrWhiteSpace(filter.Key))
        {
            filters.Add(builder.Regex(x => x.Key, new BsonRegularExpression(filter.Key, "i")));
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            filters.Add(builder.Eq(x => x.Status, filter.Status));
        }

        var queryFilter = builder.And(filters);
        var collection = mongoDb.CollectionOf<ExperimentMetric>();
        var totalCount = await collection.CountDocumentsAsync(queryFilter);
        var pageSize = filter.PageSize <= 0 ? 50 : filter.PageSize;
        var pageIndex = Math.Max(filter.PageIndex, 0);
        var metrics = await collection
            .Find(queryFilter)
            .SortBy(x => x.Key)
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return new PagedResult<ExperimentMetric>(totalCount, metrics);
    }

    public async Task<ExperimentMetric> CreateAsync(
        Guid envId,
        CreateExperimentMetricRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var now = DateTime.UtcNow;
        var metric = new ExperimentMetric
        {
            Id = Guid.NewGuid(),
            FeatBitEnvId = envId,
            Name = Normalize(request.Name)!,
            Key = Normalize(request.Key)!,
            Description = Normalize(request.Description),
            MetricType = NormalizeMetricType(request.MetricType),
            MetricAgg = NormalizeMetricAgg(request.MetricType, request.MetricAgg),
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };

        await mongoDb.CollectionOf<ExperimentMetric>().InsertOneAsync(metric);
        return metric;
    }

    public async Task<ExperimentMetric> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentMetricRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var metric = await GetMetricAsync(envId, id);
        metric.Name = Normalize(request.Name, metric.Name)!;
        metric.Description = Normalize(request.Description);
        metric.MetricType = NormalizeMetricType(request.MetricType);
        metric.MetricAgg = NormalizeMetricAgg(metric.MetricType, request.MetricAgg);
        metric.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ExperimentMetric>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, metric);

        return metric;
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var metric = await GetMetricAsync(envId, id);
        metric.Status = "archived";
        metric.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ExperimentMetric>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, metric);
    }

    public async Task RestoreAsync(Guid envId, Guid id)
    {
        var metric = await GetMetricAsync(envId, id);
        metric.Status = "active";
        metric.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ExperimentMetric>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, metric);
    }

    public async Task<ExperimentMetric> GetBySelectorAsync(
        Guid envId,
        Guid? id,
        string key)
    {
        var normalizedKey = Normalize(key);
        var metric = await mongoDb.CollectionOf<ExperimentMetric>()
            .Find(x =>
                x.FeatBitEnvId == envId &&
                x.Status == "active" &&
                ((id.HasValue && x.Id == id.Value) ||
                 (!string.IsNullOrWhiteSpace(normalizedKey) && x.Key == normalizedKey)))
            .FirstOrDefaultAsync();

        if (metric == null)
        {
            throw new EntityNotFoundException(nameof(ExperimentMetric), $"{envId}-{id}-{normalizedKey}");
        }

        return metric;
    }

    private async Task<ExperimentMetric> GetMetricAsync(Guid envId, Guid id)
    {
        var metric = await mongoDb.CollectionOf<ExperimentMetric>()
            .Find(x => x.Id == id && x.FeatBitEnvId == envId)
            .FirstOrDefaultAsync();

        if (metric == null)
        {
            throw new EntityNotFoundException(nameof(ExperimentMetric), $"{envId}-{id}");
        }

        return metric;
    }

    private static string? Normalize(string? value, string? fallback = null)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static string NormalizeMetricType(string? value)
    {
        return value == "numeric" ? "numeric" : "binary";
    }

    private static string NormalizeMetricAgg(string? metricType, string? value)
    {
        if (NormalizeMetricType(metricType) == "binary")
        {
            return "once";
        }

        return value is "count" or "sum" or "average" ? value : "once";
    }

}
