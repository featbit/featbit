using System.Text.Json;
using System.Text.Json.Nodes;
using Application.Caches;
using Domain.AuditLogs;
using Domain.Messages;
using Domain.Segments;

namespace Application.Segments;

public class OnSegmentChange : INotification
{
    public Segment Segment { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public Guid OperatorId { get; set; }

    public string Comment { get; set; }

    public OnSegmentChange(
        Segment segment,
        string operation,
        DataChange dataChange,
        Guid operatorId,
        string comment = "")
    {
        Segment = segment;
        Operation = operation;
        DataChange = dataChange;
        OperatorId = operatorId;
        Comment = comment;
    }

    public AuditLog GetAuditLog()
    {
        var auditLog = AuditLog.For(Segment, Operation, DataChange, Comment, OperatorId);

        return auditLog;
    }
}

public class OnSegmentChangeHandler : INotificationHandler<OnSegmentChange>
{
    private readonly ISegmentService _segmentService;
    private readonly IMessageProducer _messageProducer;
    private readonly ICacheService _cache;
    private readonly IAuditLogService _auditLogService;
    private readonly IWebhookHandler _webhookHandler;

    public OnSegmentChangeHandler(
        ISegmentService segmentService,
        IMessageProducer messageProducer,
        ICacheService cache,
        IAuditLogService auditLogService,
        IWebhookHandler webhookHandler)
    {
        _segmentService = segmentService;
        _messageProducer = messageProducer;
        _cache = cache;
        _auditLogService = auditLogService;
        _webhookHandler = webhookHandler;
    }

    public async Task Handle(OnSegmentChange notification, CancellationToken cancellationToken)
    {
        // write audit log
        await _auditLogService.AddOneAsync(notification.GetAuditLog());

        var segment = notification.Segment;
        var envIds = await _segmentService.GetEnvironmentIdsAsync(segment);

        // update cache
        await _cache.UpsertSegmentAsync(envIds, segment);

        foreach (var envId in envIds)
        {
            // publish segment change message
            await PublishSegmentChangeMessage(envId);

            // handle webhook
            _ = _webhookHandler.HandleAsync(
                envId,
                segment,
                notification.DataChange,
                notification.OperatorId
            );
        }

        return;

        async Task PublishSegmentChangeMessage(Guid envId)
        {
            var hasNoFlagReferences =
                notification.Operation is Operations.Archive or Operations.Restore or Operations.Create;

            var flagReferences = hasNoFlagReferences
                ? []
                : await _segmentService.GetFlagReferencesAsync(envId, segment.Id);

            JsonObject message = new()
            {
                ["segment"] = segment.SerializeAsEnvironmentSpecific(envId),
                ["affectedFlagIds"] = JsonSerializer.SerializeToNode(flagReferences.Select(x => x.Id))
            };

            await _messageProducer.PublishAsync(Topics.SegmentChange, message);
        }
    }
}