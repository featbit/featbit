using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Experiments.ExperimentMetrics;
using Application.Services;
using Domain.Experiments;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ExperimentMetricService(AppDbContext dbContext) : IExperimentMetricService
{
    public async Task<PagedResult<ExperimentMetric>> GetListAsync(
        Guid envId,
        ExperimentMetricFilter filter,
        IReadOnlyCollection<string> referencedKeys)
    {
        referencedKeys ??= [];

        filter ??= new ExperimentMetricFilter();

        var query = dbContext.Set<ExperimentMetric>()
            .AsNoTracking()
            .Where(x => x.FeatBitEnvId == envId);

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
        {
            var searchText = filter.SearchText.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.Name.ToLower().Contains(searchText) ||
                x.Key.ToLower().Contains(searchText) ||
                referencedKeys.Contains(x.Key));
        }

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            query = query.Where(x => x.Name.Contains(filter.Name));
        }

        if (!string.IsNullOrWhiteSpace(filter.Key))
        {
            query = query.Where(x => x.Key.Contains(filter.Key));
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            query = query.Where(x => x.Status == filter.Status);
        }

        var totalCount = await query.LongCountAsync();
        var pageSize = filter.PageSize <= 0 ? 50 : filter.PageSize;
        var pageIndex = Math.Max(filter.PageIndex, 0);
        var metrics = await query
            .OrderBy(x => x.Key)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
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

        await dbContext.Set<ExperimentMetric>().AddAsync(metric);
        await dbContext.SaveChangesAsync();

        return metric;
    }

    public async Task<ExperimentMetric> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentMetricRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var metric = await GetTrackedMetricAsync(envId, id);
        metric.Name = Normalize(request.Name, metric.Name)!;
        metric.Description = Normalize(request.Description);
        metric.MetricType = NormalizeMetricType(request.MetricType);
        metric.MetricAgg = NormalizeMetricAgg(metric.MetricType, request.MetricAgg);
        metric.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return metric;
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var metric = await GetTrackedMetricAsync(envId, id);
        metric.Status = "archived";
        metric.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
    }

    public async Task RestoreAsync(Guid envId, Guid id)
    {
        var metric = await GetTrackedMetricAsync(envId, id);
        metric.Status = "active";
        metric.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
    }

    public async Task<ExperimentMetric> GetBySelectorAsync(
        Guid envId,
        Guid? id,
        string key)
    {
        var normalizedKey = Normalize(key);
        var metric = await dbContext.Set<ExperimentMetric>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x =>
                x.FeatBitEnvId == envId &&
                x.Status == "active" &&
                ((id.HasValue && x.Id == id.Value) ||
                 (!string.IsNullOrWhiteSpace(normalizedKey) && x.Key == normalizedKey)));

        if (metric == null)
        {
            throw new EntityNotFoundException(nameof(ExperimentMetric), $"{envId}-{id}-{normalizedKey}");
        }

        return metric;
    }

    private async Task<ExperimentMetric> GetTrackedMetricAsync(Guid envId, Guid id)
    {
        var metric = await dbContext.Set<ExperimentMetric>()
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

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
