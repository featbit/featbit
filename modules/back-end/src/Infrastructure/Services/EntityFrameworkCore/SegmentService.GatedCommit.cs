using System.Text.Json;
using Application;
using Application.Bases.Exceptions;
using Application.ControlPlane;
using Application.Segments;
using Domain.Segments;
using Domain.Utils;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public partial class SegmentService : IGatedSegmentStore
{
    public bool GatedCommitEnabled => configuration?.UseControlPlane() == true &&
        configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit;

    public async Task StageChangeAsync(OnSegmentChange change, bool isNew)
    {
        var desired = change.Segment;
        if (desired.Pending != null) throw new ConflictException(nameof(Segment), desired.Id);
        if (desired.Id == Guid.Empty) desired.Id = Guid.NewGuid();
        var stored = isNew ? JsonSerializer.Deserialize<Segment>(JsonSerializer.Serialize(desired, ReusableJsonSerializerOptions.Web), ReusableJsonSerializerOptions.Web)! : await GetAsync(desired.Id);
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
            stored.SetPending(desired, version, change.OperatorId, change.Operation, change.IsTargetingChange);
            stored.Pending.IsCreation = true;
            await AddOneAsync(stored);
            return;
        }
        if (stored.CommittedVersion != desired.CommittedVersion)
            throw new ConflictException(nameof(Segment), desired.Id);
        if (stored.Pending != null || stored.Xmin != desired.Xmin)
            throw new ConflictException(nameof(Segment), desired.Id);
        stored.SetPending(desired, version, change.OperatorId, change.Operation, change.IsTargetingChange);
        try { await base.UpdateAsync(stored); }
        catch (DbUpdateConcurrencyException) { throw new ConflictException(nameof(Segment), desired.Id); }
    }

    public async Task<bool> AcknowledgePublicationAsync(Guid id, long expectedVersion)
    {
        // Promotion already tracks this row in the coordinator's scope. A conditional SQL
        // update acknowledges only this receipt without attaching a second entity instance
        // or replacing fields concurrently changed after promotion.
        var receipt = JsonSerializer.Serialize(new { Version = expectedVersion, IsCommitted = true },
            ReusableJsonSerializerOptions.Web);
        var acknowledged = await Queryable.Where(x => x.Id == id &&
                x.CommittedVersion == expectedVersion && EF.Functions.JsonContains(x.Pending, receipt))
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Pending, (PendingSegmentChange)null!));
        return acknowledged > 0;
    }

    public override async Task DeleteOneAsync(Guid id)
    {
        if (!GatedCommitEnabled) { await base.DeleteOneAsync(id); return; }
        var deleted = await Queryable.Where(x => x.Id == id && x.IsArchived && x.Pending == null).ExecuteDeleteAsync();
        if (deleted == 0) throw new ConflictException(nameof(Segment), id);
    }
}
