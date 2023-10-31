using Application.Caches;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class OnFeatureFlagDeleted : INotification
{
    public FeatureFlag Flag { get; set; }

    public Guid OperatorId { get; set; }

    public OnFeatureFlagDeleted(FeatureFlag flag, Guid operatorId)
    {
        Flag = flag;
        OperatorId = operatorId;
    }

    public AuditLog GetAuditLog()
    {
        var dataChange = new DataChange(Flag).To(null);

        var auditLog = AuditLog.For(Flag, Operations.Remove, dataChange, string.Empty, OperatorId);
        return auditLog;
    }
}

public class OnFeatureFlagDeletedHandler : INotificationHandler<OnFeatureFlagDeleted>
{
    private readonly ICacheService _cache;
    private readonly IAuditLogService _auditLogService;

    public OnFeatureFlagDeletedHandler(ICacheService cache, IAuditLogService auditLogService)
    {
        _cache = cache;
        _auditLogService = auditLogService;
    }

    public async Task Handle(OnFeatureFlagDeleted notification, CancellationToken cancellationToken)
    {
        // write audit log
        await _auditLogService.AddOneAsync(notification.GetAuditLog());

        // delete cache
        var envId = notification.Flag.EnvId;
        var flagId = notification.Flag.Id;
        await _cache.DeleteFlagAsync(envId, flagId);
    }
}