using System.Text.RegularExpressions;
using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.Experiments.ExperimentLayers;
using Application.Services;
using Domain.Experiments;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ExperimentLayerService(MongoDbClient mongoDb) : IExperimentLayerService
{
    public async Task<PagedResult<ExperimentLayer>> GetListAsync(
        Guid envId,
        ExperimentLayerFilter filter)
    {
        filter ??= new ExperimentLayerFilter();
        var builder = Builders<ExperimentLayer>.Filter;
        var filters = new List<FilterDefinition<ExperimentLayer>>
        {
            builder.Eq(x => x.FeatBitEnvId, envId)
        };

        if (!string.IsNullOrWhiteSpace(filter.SearchText))
        {
            var search = new BsonRegularExpression(Regex.Escape(filter.SearchText.Trim()), "i");
            filters.Add(builder.Or(
                builder.Regex(x => x.Name, search),
                builder.Regex(x => x.Key, search)));
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

        await mongoDb.CollectionOf<ExperimentLayer>().InsertOneAsync(layer);
        return layer;
    }

    public async Task<ExperimentLayer> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentLayerRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var layer = await GetLayerAsync(envId, id);
        layer.Name = Normalize(request.Name, layer.Name)!;
        layer.Description = Normalize(request.Description);
        layer.AssignmentUnitSelector = Normalize(request.AssignmentUnitSelector) ?? "user.keyId";
        layer.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ExperimentLayer>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, layer);

        return layer;
    }

    public async Task ArchiveAsync(Guid envId, Guid id)
    {
        var layer = await GetLayerAsync(envId, id);
        layer.Status = "archived";
        layer.UpdatedAt = DateTime.UtcNow;

        await mongoDb.CollectionOf<ExperimentLayer>()
            .ReplaceOneAsync(x => x.Id == id && x.FeatBitEnvId == envId, layer);
    }

    public async Task RestoreAsync(Guid envId, Guid id)
    {
        var layer = await GetLayerAsync(envId, id);
        layer.Status = "active";
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

    private static string? Normalize(string? value, string? fallback = null)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }
}
