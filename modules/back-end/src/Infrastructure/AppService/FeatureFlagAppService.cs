using Application.Caches;
using Application.FeatureFlags;
using Domain.AuditLogs;
using Domain.Segments;
using MediatR;

namespace Infrastructure.AppService;

public class FeatureFlagAppService : IFeatureFlagAppService
{
    private readonly IFeatureFlagService _flagService;
    private readonly IFlagDraftService _flagDraftService;
    private readonly IAuditLogService _auditLogService;
    private readonly ICacheService _cacheService;
    private readonly IPublisher _publisher;

    public FeatureFlagAppService(
        IFeatureFlagService featureFlagService,
        IFlagDraftService flagDraftService,
        IAuditLogService auditLogService,
        ICacheService cacheService,
        IPublisher publisher)
    {
        _flagService = featureFlagService;
        _flagDraftService = flagDraftService;
        _auditLogService = auditLogService;
        _cacheService = cacheService;
        _publisher = publisher;
    }

    public async Task ApplyDraftAsync(Guid draftId, string operation, Guid operatorId)
    {
        // check draft status
        var draft = await _flagDraftService.GetAsync(draftId);
        if (draft.IsApplied())
        {
            return;
        }

        // apply flag draft
        var flag = await _flagService.GetAsync(draft.FlagId);
        var dataChange = flag.ApplyDraft(draft);
        await _flagService.UpdateAsync(flag);

        // update draft status
        draft.Applied(operatorId);
        await _flagDraftService.UpdateAsync(draft);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag, operation, dataChange, operatorId, draft.Comment
        );
        await _publisher.Publish(notification);
    }

    public async Task OnSegmentUpdatedAsync(Segment segment, Guid operatorId, ICollection<FlagReference> flagReferences)
    {
        // mark flags as updated
        var flagIds = flagReferences.Select(x => x.Id).ToArray();
        await _flagService.MarkAsUpdatedAsync(flagIds, operatorId);

        List<AuditLog> auditLogs = [];

        var flags = await _flagService.FindManyAsync(x => flagIds.Contains(x.Id));
        foreach (var flag in flags)
        {
            var dataChange = new DataChange(flag);
            flag.ReferencedSegmentTargetingUpdated(operatorId);
            dataChange.To(flag);

            // update flag cache
            await _cacheService.UpsertFlagAsync(flag);

            var auditLog = AuditLog.For(
                flag,
                Operations.Update,
                dataChange,
                $"Referenced segment '{segment.Name}' has been updated.",
                operatorId
            );

            auditLogs.Add(auditLog);
        }

        // write audit logs
        await _auditLogService.AddManyAsync(auditLogs);
    }
}