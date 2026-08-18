using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.Experiments;
using Application.Services;
using Domain.Experiments;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ExperimentLayerService(AppDbContext dbContext) : IExperimentLayerService
{
    public async Task<PagedResult<ExperimentLayerVm>> GetListAsync(
        Guid envId,
        ExperimentLayerFilter filter)
    {
        filter ??= new ExperimentLayerFilter();

        var query = dbContext.Set<ExperimentLayer>()
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
        var layers = await query
            .OrderBy(x => x.Key)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<ExperimentLayerVm>(totalCount, layers.Select(ToVm).ToArray());
    }

    public async Task<ExperimentLayerVm> CreateAsync(
        Guid envId,
        ExperimentLayerUpdate update)
    {
        update ??= new ExperimentLayerUpdate();
        var now = DateTime.UtcNow;
        var layer = new ExperimentLayer
        {
            Id = Guid.NewGuid(),
            FeatBitEnvId = envId,
            Name = Normalize(update.Name)!,
            Key = Normalize(update.Key)!,
            Description = Normalize(update.Description),
            AssignmentUnitSelector = Normalize(update.AssignmentUnitSelector) ?? "user.keyId",
            Status = NormalizeStatus(update.Status),
            CreatedAt = now,
            UpdatedAt = now
        };

        await dbContext.Set<ExperimentLayer>().AddAsync(layer);
        await dbContext.SaveChangesAsync();

        return ToVm(layer);
    }

    public async Task<ExperimentLayerVm> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentLayerUpdate update)
    {
        update ??= new ExperimentLayerUpdate();
        var layer = await GetTrackedLayerAsync(envId, id);
        layer.Name = Normalize(update.Name, layer.Name)!;
        layer.Key = Normalize(update.Key, layer.Key)!;
        layer.Description = Normalize(update.Description);
        layer.AssignmentUnitSelector = Normalize(update.AssignmentUnitSelector) ?? "user.keyId";
        layer.Status = NormalizeStatus(update.Status, layer.Status);
        layer.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return ToVm(layer);
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var layer = await GetTrackedLayerAsync(envId, id);
        layer.Status = "archived";
        layer.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
    }

    private async Task<ExperimentLayer> GetTrackedLayerAsync(Guid envId, Guid id)
    {
        var layer = await dbContext.Set<ExperimentLayer>()
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (layer == null)
        {
            throw new EntityNotFoundException(nameof(ExperimentLayer), $"{envId}-{id}");
        }

        return layer;
    }

    private static ExperimentLayerVm ToVm(ExperimentLayer layer)
    {
        return new ExperimentLayerVm
        {
            Id = layer.Id,
            FeatBitEnvId = layer.FeatBitEnvId,
            Name = layer.Name,
            Key = layer.Key,
            Description = layer.Description,
            AssignmentUnitSelector = layer.AssignmentUnitSelector,
            Status = layer.Status,
            CreatedAt = layer.CreatedAt,
            UpdatedAt = layer.UpdatedAt
        };
    }

    private static string? Normalize(string? value, string? fallback = null)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static string NormalizeStatus(string? value, string fallback = "active")
    {
        return string.Equals(value, "archived", StringComparison.OrdinalIgnoreCase) ? "archived" : fallback;
    }
}
