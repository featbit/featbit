using Application.FeatureFlags;
using Application.Segments;
using Domain.SemanticPatch;
using Domain.Webhooks;

namespace Application.Webhooks;

public class WebhookHandler : IWebhookHandler
{
    private static readonly string[] FlagCreatedEvents = { WebhookEvents.FlagEvents.Created };
    private static readonly string[] FlagDeletedEvents = { WebhookEvents.FlagEvents.Deleted };

    private static readonly string[] SegmentCreatedEvents = { WebhookEvents.SegmentEvents.Created };
    private static readonly string[] SegmentDeletedEvents = { WebhookEvents.SegmentEvents.Deleted };

    private readonly IWebhookService _webhookService;
    private readonly IWebhookSender _webhookSender;
    private readonly IEnvironmentService _environmentService;
    private readonly IUserService _userService;

    public WebhookHandler(
        IWebhookService webhookService,
        IWebhookSender webhookSender,
        IEnvironmentService environmentService,
        IUserService userService)
    {
        _webhookService = webhookService;
        _webhookSender = webhookSender;
        _environmentService = environmentService;
        _userService = userService;
    }

    public async Task HandleAsync(OnFeatureFlagChanged notification)
    {
        string[] events;

        var dataChange = notification.DataChange;
        if (dataChange.IsCreation())
        {
            events = FlagCreatedEvents;
        }
        else if (dataChange.IsDeletion())
        {
            events = FlagDeletedEvents;
        }
        else
        {
            var instructions = FlagComparer.Compare(dataChange).ToArray();
            events = instructions
                .Select(x => WebhookEvents.FlagEvents.FromInstructionKind(x.Kind))
                .Distinct()
                .ToArray();
        }

        var flag = notification.Flag;

        var resourceDescriptor = await _environmentService.GetResourceDescriptorAsync(flag.EnvId);
        var webhooks = await _webhookService.GetByEventsAsync(resourceDescriptor.Organization.Id, events);
        var @operator = await _userService.GetOperatorAsync(notification.OperatorId);

        var dataObject = DataObjectBuilder
            .New(events, @operator, flag.UpdatedAt)
            .AddResourceDescriptor(resourceDescriptor)
            .AddFeatureFlag(flag);

        foreach (var webhook in webhooks)
        {
            await _webhookSender.SendAsync(webhook, dataObject);
        }
    }

    public async Task HandleAsync(OnSegmentChange notification)
    {
        string[] events;

        var dataChange = notification.DataChange;
        if (dataChange.IsCreation())
        {
            events = SegmentCreatedEvents;
        }
        else if (dataChange.IsDeletion())
        {
            events = SegmentDeletedEvents;
        }
        else
        {
            var instructions = SegmentComparer.Compare(dataChange).ToArray();
            events = instructions
                .Select(x => WebhookEvents.SegmentEvents.FromInstructionKind(x.Kind))
                .Distinct()
                .ToArray();
        }

        var segment = notification.Segment;

        var resourceDescriptor = await _environmentService.GetResourceDescriptorAsync(segment.EnvId);
        var webhooks = await _webhookService.GetByEventsAsync(resourceDescriptor.Organization.Id, events);
        var @operator = await _userService.GetOperatorAsync(notification.OperatorId);

        var dataObject = DataObjectBuilder
            .New(events, @operator, segment.UpdatedAt)
            .AddResourceDescriptor(resourceDescriptor)
            .AddSegment(segment);

        foreach (var webhook in webhooks)
        {
            await _webhookSender.SendAsync(webhook, dataObject);
        }
    }
}