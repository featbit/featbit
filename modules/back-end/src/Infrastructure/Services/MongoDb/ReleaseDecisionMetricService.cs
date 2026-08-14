using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.ReleaseDecisions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionMetricService(MongoDbClient mongoDb) : IReleaseDecisionMetricService
{
    public async Task<PagedResult<ReleaseDecisionMetricVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionMetricFilter filter)
    {
        filter ??= new ReleaseDecisionMetricFilter();
        var builder = Builders<ReleaseDecisionMetric>.Filter;
        var filters = new List<FilterDefinition<ReleaseDecisionMetric>>
        {
            builder.Eq(x => x.FeatBitEnvId, envId)
        };

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
        var collection = mongoDb.CollectionOf<ReleaseDecisionMetric>();
        var totalCount = await collection.CountDocumentsAsync(queryFilter);
        var pageSize = filter.PageSize <= 0 ? 50 : filter.PageSize;
        var pageIndex = Math.Max(filter.PageIndex, 0);
        var metrics = await collection
            .Find(queryFilter)
            .SortBy(x => x.Key)
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return new PagedResult<ReleaseDecisionMetricVm>(totalCount, metrics.Select(ToVm).ToArray());
    }

    public async Task<ReleaseDecisionMetricVm> CreateAsync(
        Guid envId,
        ReleaseDecisionMetricUpdate update)
    {
        update ??= new ReleaseDecisionMetricUpdate();
        var now = DateTime.UtcNow;
        var metric = new ReleaseDecisionMetric
        {
            Id = Guid.NewGuid(),
            FeatBitEnvId = envId,
            Name = Normalize(update.Name)!,
            Key = Normalize(update.Key)!,
            Description = Normalize(update.Description),
            MetricType = NormalizeMetricType(update.MetricType),
            MetricAgg = NormalizeMetricAgg(update.MetricType, update.MetricAgg),
            Status = NormalizeStatus(update.Status),
            CreatedAt = now,
            UpdatedAt = now
        };

        await mongoDb.CollectionOf<ReleaseDecisionMetric>().InsertOneAsync(metric);
        return ToVm(metric);
    }

    public async Task<ReleaseDecisionMetricVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionMetricUpdate update)
    {
        update ??= new ReleaseDecisionMetricUpdate();
        var metric = await GetMetricAsync(envId, id);
        metric.Name = Normalize(update.Name, metric.Name)!;
        metric.Key = Normalize(update.Key, metric.Key)!;
        metric.Description = Normalize(update.Description);
        metric.MetricType = NormalizeMetricType(update.MetricType);
        metric.MetricAgg = NormalizeMetricAgg(metric.MetricType, update.MetricAgg);
        metric.Status = NormalizeStatus(update.Status, metric.Status);
        metric.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ReleaseDecisionMetric>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, metric);

        return ToVm(metric);
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var metric = await GetMetricAsync(envId, id);
        metric.Status = "archived";
        metric.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ReleaseDecisionMetric>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, metric);
    }

    public async Task<ReleaseDecisionMetricVm> GetBySelectorAsync(
        Guid envId,
        Guid? id,
        string key)
    {
        var normalizedKey = Normalize(key);
        var metric = await mongoDb.CollectionOf<ReleaseDecisionMetric>()
            .Find(x =>
                x.FeatBitEnvId == envId &&
                x.Status == "active" &&
                ((id.HasValue && x.Id == id.Value) ||
                 (!string.IsNullOrWhiteSpace(normalizedKey) && x.Key == normalizedKey)))
            .FirstOrDefaultAsync();

        if (metric == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionMetric), $"{envId}-{id}-{normalizedKey}");
        }

        return ToVm(metric);
    }

    private async Task<ReleaseDecisionMetric> GetMetricAsync(Guid envId, Guid id)
    {
        var metric = await mongoDb.CollectionOf<ReleaseDecisionMetric>()
            .Find(x => x.Id == id && x.FeatBitEnvId == envId)
            .FirstOrDefaultAsync();

        if (metric == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionMetric), $"{envId}-{id}");
        }

        return metric;
    }

    private static ReleaseDecisionMetricVm ToVm(ReleaseDecisionMetric metric)
    {
        return new ReleaseDecisionMetricVm
        {
            Id = metric.Id,
            FeatBitEnvId = metric.FeatBitEnvId,
            Name = metric.Name,
            Key = metric.Key,
            Description = metric.Description,
            MetricType = metric.MetricType,
            MetricAgg = metric.MetricAgg,
            Status = metric.Status,
            CreatedAt = metric.CreatedAt,
            UpdatedAt = metric.UpdatedAt
        };
    }

    private static string? Normalize(string? value, string? fallback = null)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static string NormalizeMetricType(string? value)
    {
        return value is "continuous" or "numeric" ? "continuous" : "binary";
    }

    private static string NormalizeMetricAgg(string? metricType, string? value)
    {
        if (NormalizeMetricType(metricType) == "binary")
        {
            return "once";
        }

        return value is "count" or "sum" or "average" ? value : "once";
    }

    private static string NormalizeStatus(string? value, string fallback = "active")
    {
        return string.Equals(value, "archived", StringComparison.OrdinalIgnoreCase) ? "archived" : fallback;
    }
}
