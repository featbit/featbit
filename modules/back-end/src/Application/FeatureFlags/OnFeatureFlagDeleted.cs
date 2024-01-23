using Application.Caches;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class OnFeatureFlagDeleted : INotification
{
    public FeatureFlag Flag { get; set; }

    public Guid OperatorId { get; set; }

    public DataChange DataChange { get; set; }

    public OnFeatureFlagDeleted(FeatureFlag flag, Guid operatorId)
    {
        Flag = flag;
        OperatorId = operatorId;
        DataChange = new DataChange(flag).To(null);
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Flag, Operations.Remove, DataChange, string.Empty, OperatorId);
        return auditLog;
    }
}

public class OnFeatureFlagDeletedHandler : INotificationHandler<OnFeatureFlagDeleted>
{
    private readonly ICacheService _cache;
    private readonly IAuditLogService _auditLogService;
    private readonly IWebhookHandler _webhookHandler;

    public OnFeatureFlagDeletedHandler(
        ICacheService cache,
        IAuditLogService auditLogService,
        IWebhookHandler webhookHandler)
    {
        _cache = cache;
        _auditLogService = auditLogService;
        _webhookHandler = webhookHandler;
    }

    public async Task Handle(OnFeatureFlagDeleted notification, CancellationToken cancellationToken)
    {
        // write audit log
        await _auditLogService.AddOneAsync(notification.GetAuditLog());

        // delete cache
        var envId = notification.Flag.EnvId;
        var flagId = notification.Flag.Id;
        await _cache.DeleteFlagAsync(envId, flagId);

        // handle webhooks
        _ = _webhookHandler.HandleAsync(notification.Flag, notification.DataChange, notification.OperatorId);
    }
}