using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Experiments;
using Application.Services;
using Domain.Experiments;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ExperimentMetricService(AppDbContext dbContext) : IExperimentMetricService
{
    public async Task<PagedResult<ExperimentMetricVm>> GetListAsync(
        Guid envId,
        ExperimentMetricFilter filter)
    {
        filter ??= new ExperimentMetricFilter();

        var query = dbContext.Set<ExperimentMetric>()
            .AsNoTracking()
            .Where(x => x.FeatBitEnvId == envId);

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

        return new PagedResult<ExperimentMetricVm>(totalCount, metrics.Select(ToVm).ToArray());
    }

    public async Task<ExperimentMetricVm> CreateAsync(
        Guid envId,
        ExperimentMetricUpdate update)
    {
        update ??= new ExperimentMetricUpdate();
        var now = DateTime.UtcNow;
        var metric = new ExperimentMetric
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

        await dbContext.Set<ExperimentMetric>().AddAsync(metric);
        await dbContext.SaveChangesAsync();

        return ToVm(metric);
    }

    public async Task<ExperimentMetricVm> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentMetricUpdate update)
    {
        update ??= new ExperimentMetricUpdate();
        var metric = await GetTrackedMetricAsync(envId, id);
        metric.Name = Normalize(update.Name, metric.Name)!;
        metric.Key = Normalize(update.Key, metric.Key)!;
        metric.Description = Normalize(update.Description);
        metric.MetricType = NormalizeMetricType(update.MetricType);
        metric.MetricAgg = NormalizeMetricAgg(metric.MetricType, update.MetricAgg);
        metric.Status = NormalizeStatus(update.Status, metric.Status);
        metric.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return ToVm(metric);
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var metric = await GetTrackedMetricAsync(envId, id);
        metric.Status = "archived";
        metric.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
    }

    public async Task<ExperimentMetricVm> GetBySelectorAsync(
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

        return ToVm(metric);
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

    private static ExperimentMetricVm ToVm(ExperimentMetric metric)
    {
        return new ExperimentMetricVm
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
