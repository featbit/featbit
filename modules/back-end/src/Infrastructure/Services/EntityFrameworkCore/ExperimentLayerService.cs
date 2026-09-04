using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.Experiments.ExperimentLayers;
using Application.Services;
using Domain.Experiments;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ExperimentLayerService(AppDbContext dbContext) : IExperimentLayerService
{
    public async Task<PagedResult<ExperimentLayer>> GetListAsync(
        Guid envId,
        ExperimentLayerFilter filter)
    {
        filter ??= new ExperimentLayerFilter();

        var query = dbContext.Set<ExperimentLayer>()
            .AsNoTracking()
            .Where(x => x.FeatBitEnvId == envId);

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
        {
            query = query.Where(x =>
                x.Name.Contains(filter.SearchText) ||
                x.Key.Contains(filter.SearchText));
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
        var layers = await query
            .OrderBy(x => x.Key)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResult<ExperimentLayer>(totalCount, layers);
    }

    public async Task<ExperimentLayer> CreateAsync(
        Guid envId,
        CreateExperimentLayerRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var now = DateTime.UtcNow;
        var layer = new ExperimentLayer
        {
            Id = Guid.NewGuid(),
            FeatBitEnvId = envId,
            Name = Normalize(request.Name)!,
            Key = Normalize(request.Key)!,
            Description = Normalize(request.Description),
            AssignmentUnitSelector = Normalize(request.AssignmentUnitSelector) ?? "user.keyId",
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };

        await dbContext.Set<ExperimentLayer>().AddAsync(layer);
        await dbContext.SaveChangesAsync();

        return layer;
    }

    public async Task<ExperimentLayer> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentLayerRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var layer = await GetTrackedLayerAsync(envId, id);
        layer.Name = Normalize(request.Name, layer.Name)!;
        layer.Description = Normalize(request.Description);
        layer.AssignmentUnitSelector = Normalize(request.AssignmentUnitSelector) ?? "user.keyId";
        layer.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return layer;
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var layer = await GetTrackedLayerAsync(envId, id);
        layer.Status = "archived";
        layer.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
    }

    public async Task RestoreAsync(Guid envId, Guid id)
    {
        var layer = await GetTrackedLayerAsync(envId, id);
        layer.Status = "active";
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

    private static string? Normalize(string? value, string? fallback = null)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }
}
