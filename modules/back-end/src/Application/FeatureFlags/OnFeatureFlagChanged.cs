using Application.Caches;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagRevisions;
using Domain.Messages;

namespace Application.FeatureFlags;

public class OnFeatureFlagChanged : INotification
{
    public FeatureFlag Flag { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public Guid OperatorId { get; set; }

    public string Comment { get; set; }

    public OnFeatureFlagChanged(
        FeatureFlag flag,
        string operation,
        DataChange dataChange,
        Guid operatorId,
        string comment = "")
    {
        Flag = flag;
        Operation = operation;
        DataChange = dataChange;
        OperatorId = operatorId;
        Comment = comment;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Flag, Operation, DataChange, Comment, OperatorId);

        return auditLog;
    }
}

public class OnFeatureFlagChangedHandler : INotificationHandler<OnFeatureFlagChanged>
{
    private readonly IFlagRevisionService _flagRevisionService;
    private readonly IMessageProducer _messageProducer;
    private readonly ICacheService _cache;
    private readonly IAuditLogService _auditLogService;
    private readonly IWebhookHandler _webhookHandler;

    public OnFeatureFlagChangedHandler(
        IFlagRevisionService flagRevisionService,
        IMessageProducer messageProducer,
        ICacheService cache,
        IAuditLogService auditLogService,
        IWebhookHandler webhookHandler)
    {
        _flagRevisionService = flagRevisionService;
        _messageProducer = messageProducer;
        _cache = cache;
        _auditLogService = auditLogService;
        _webhookHandler = webhookHandler;
    }

    public async Task Handle(OnFeatureFlagChanged notification, CancellationToken cancellationToken)
    {
        var flag = notification.Flag;

        // write audit log
        await _auditLogService.AddOneAsync(notification.GetAuditLog());

        // update cache
        await _cache.UpsertFlagAsync(flag);

        // create flag revision
        var revision = new FlagRevision(flag, notification.Comment);
        await _flagRevisionService.AddOneAsync(revision);

        // publish feature flag change message
        await _messageProducer.PublishAsync(Topics.FeatureFlagChange, flag);

        // handle webhooks
        _ = _webhookHandler.HandleAsync(notification.Flag, notification.DataChange, notification.OperatorId);
    }
}