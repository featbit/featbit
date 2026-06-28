using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionLayerService(AppDbContext dbContext) : IReleaseDecisionLayerService
{
    public async Task<PagedResult<ReleaseDecisionLayerVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionLayerFilter filter)
    {
        filter ??= new ReleaseDecisionLayerFilter();

        var query = dbContext.Set<ReleaseDecisionLayer>()
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

        return new PagedResult<ReleaseDecisionLayerVm>(totalCount, layers.Select(ToVm).ToArray());
    }

    public async Task<ReleaseDecisionLayerVm> CreateAsync(
        Guid envId,
        ReleaseDecisionLayerUpdate update)
    {
        update ??= new ReleaseDecisionLayerUpdate();
        var now = DateTime.UtcNow;
        var layer = new ReleaseDecisionLayer
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

        await dbContext.Set<ReleaseDecisionLayer>().AddAsync(layer);
        await dbContext.SaveChangesAsync();

        return ToVm(layer);
    }

    public async Task<ReleaseDecisionLayerVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionLayerUpdate update)
    {
        update ??= new ReleaseDecisionLayerUpdate();
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

    private async Task<ReleaseDecisionLayer> GetTrackedLayerAsync(Guid envId, Guid id)
    {
        var layer = await dbContext.Set<ReleaseDecisionLayer>()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (layer == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionLayer), $"{envId}-{id}");
        }

        return layer;
    }

    private static ReleaseDecisionLayerVm ToVm(ReleaseDecisionLayer layer)
    {
        return new ReleaseDecisionLayerVm
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
