using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.Experiments;
using Application.Services;
using Domain.Experiments;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ExperimentLayerService(MongoDbClient mongoDb) : IExperimentLayerService
{
    public async Task<PagedResult<ExperimentLayerVm>> GetListAsync(
        Guid envId,
        ExperimentLayerFilter filter)
    {
        filter ??= new ExperimentLayerFilter();
        var builder = Builders<ExperimentLayer>.Filter;
        var filters = new List<FilterDefinition<ExperimentLayer>>
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
        var collection = mongoDb.CollectionOf<ExperimentLayer>();
        var totalCount = await collection.CountDocumentsAsync(queryFilter);
        var pageSize = filter.PageSize <= 0 ? 50 : filter.PageSize;
        var pageIndex = Math.Max(filter.PageIndex, 0);
        var layers = await collection
            .Find(queryFilter)
            .SortBy(x => x.Key)
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
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

        await mongoDb.CollectionOf<ExperimentLayer>().InsertOneAsync(layer);
        return ToVm(layer);
    }

    public async Task<ExperimentLayerVm> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentLayerUpdate update)
    {
        update ??= new ExperimentLayerUpdate();
        var layer = await GetLayerAsync(envId, id);
        layer.Name = Normalize(update.Name, layer.Name)!;
        layer.Key = Normalize(update.Key, layer.Key)!;
        layer.Description = Normalize(update.Description);
        layer.AssignmentUnitSelector = Normalize(update.AssignmentUnitSelector) ?? "user.keyId";
        layer.Status = NormalizeStatus(update.Status, layer.Status);
        layer.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ExperimentLayer>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, layer);

        return ToVm(layer);
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var layer = await GetLayerAsync(envId, id);
        layer.Status = "archived";
        layer.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ExperimentLayer>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, layer);
    }

    private async Task<ExperimentLayer> GetLayerAsync(Guid envId, Guid id)
    {
        var layer = await mongoDb.CollectionOf<ExperimentLayer>()
            .Find(x => x.Id == id && x.FeatBitEnvId == envId)
            .FirstOrDefaultAsync();

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
