using System.Text.Json;
using Application;
using Application.Bases.Exceptions;
using Application.ControlPlane;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.Utils;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public partial class FeatureFlagService : IGatedFeatureFlagStore
{
    private readonly IConfiguration? _gatedConfiguration;
    public bool GatedCommitEnabled => _gatedConfiguration?.UseControlPlane() == true &&
        _gatedConfiguration.GetConsistencyMode() == ConsistencyMode.GatedCommit;

    public async Task StageChangeAsync(OnFeatureFlagChanged change, bool isNew)
    {
        var desired = change.Flag;
        if (desired.Pending != null) throw new ConflictException(nameof(FeatureFlag), desired.Id);
        if (desired.Id == Guid.Empty) desired.Id = Guid.NewGuid();
        var stored = isNew ? desired.Clone() : await GetAsync(desired.EnvId, desired.Key);
        if (isNew)
        {
            desired.CommittedVersion = 0;
            stored.CommittedVersion = 0;
            // A newly created resource has no active committed value until the gate opens.
            stored.IsArchived = true;
        }
        var version = Math.Max(new DateTimeOffset(desired.UpdatedAt).ToUnixTimeMilliseconds(),
            checked(stored.CommittedVersion + 1));
        desired.UpdatedAt = DateTimeOffset.FromUnixTimeMilliseconds(version).UtcDateTime;
        if (isNew)
        {
            stored.SetPending(desired, version);
            stored.Pending.IsCreation = true;
            await AddOneAsync(stored);
            return;
        }
        if (stored.CommittedVersion != desired.CommittedVersion)
            throw new ConflictException(nameof(FeatureFlag), desired.Id);
        stored.SetPending(desired, version);
        var filters = Builders<FeatureFlag>.Filter;
        var filter = filters.And(
            filters.Eq(x => x.Id, desired.Id),
            filters.Eq(x => x.CommittedVersion, desired.CommittedVersion),
            filters.Eq(x => x.Pending, null),
            VersionFilter(desired));
        var update = Builders<FeatureFlag>.Update.Set(x => x.Pending, stored.Pending)
            .Set(x => x.MongoETag, Guid.NewGuid());
        var result = await Collection.UpdateOneAsync(filter, update);
        if (result.MatchedCount == 0) throw new ConflictException(nameof(FeatureFlag), desired.Id);
    }

    public async Task<bool> AcknowledgePublicationAsync(Guid envId, string key, long expectedVersion)
    {
        var stored = await GetAsync(envId, key);
        if (stored.CommittedVersion != expectedVersion || stored.Pending?.Version != expectedVersion ||
            !stored.Pending.IsCommitted) return false;
        var filters = Builders<FeatureFlag>.Filter;
        var filter = filters.And(filters.Eq(x => x.Id, stored.Id),
            filters.Eq(x => x.CommittedVersion, expectedVersion),
            filters.Eq(x => x.Pending!.Version, expectedVersion), filters.Eq(x => x.Pending!.IsCommitted, true));
        var update = Builders<FeatureFlag>.Update.Set(x => x.Pending, null)
            .Set(x => x.MongoETag, Guid.NewGuid());
        var result = await Collection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public override async Task DeleteOneAsync(Guid id)
    {
        if (!GatedCommitEnabled) { await base.DeleteOneAsync(id); return; }
        var filters = Builders<FeatureFlag>.Filter;
        var result = await Collection.DeleteOneAsync(filters.And(filters.Eq(x => x.Id, id),
            filters.Eq(x => x.IsArchived, true), filters.Eq(x => x.Pending, null)));
        if (result.DeletedCount == 0) throw new ConflictException(nameof(FeatureFlag), id);
    }
}
