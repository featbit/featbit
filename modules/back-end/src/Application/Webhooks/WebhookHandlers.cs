using System.Text.Json;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.SemanticPatch;
using Domain.Utils;
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
    private readonly ISegmentService _segmentService;

    public WebhookHandler(
        IWebhookService webhookService,
        IWebhookSender webhookSender,
        IEnvironmentService environmentService,
        IUserService userService,
        ISegmentService segmentService)
    {
        _webhookService = webhookService;
        _webhookSender = webhookSender;
        _environmentService = environmentService;
        _userService = userService;
        _segmentService = segmentService;
    }

    public async Task HandleAsync(FeatureFlag flag, DataChange dataChange, Guid operatorId)
    {
        string[] events;
        string[] changes;

        if (dataChange.IsCreation())
        {
            events = FlagCreatedEvents;
            changes = new[] { $"Created Flag: ${flag.Name}" };
        }
        else if (dataChange.IsDeletion())
        {
            events = FlagDeletedEvents;
            changes = new[] { $"Deleted Flag: ${flag.Name}" };
        }
        else
        {
            var original =
                JsonSerializer.Deserialize<FeatureFlag>(dataChange.Previous, ReusableJsonSerializerOptions.Web);
            var current =
                JsonSerializer.Deserialize<FeatureFlag>(dataChange.Current, ReusableJsonSerializerOptions.Web);

            var instructions = FlagComparer.Compare(original, current).ToArray();
            events = instructions
                .Select(x => WebhookEvents.FlagEvents.FromInstructionKind(x.Kind))
                .Distinct()
                .ToArray();
            changes = instructions
                .Select(x => InstructionDescriptor.Describe(x, original, current))
                .Distinct()
                .ToArray();
        }

        var resourceDescriptor = await _environmentService.GetResourceDescriptorAsync(flag.EnvId);
        var webhooks = await _webhookService.GetByEventsAsync(resourceDescriptor.Organization.Id, events);

        var activeWebhooks = webhooks.Where(x => x.IsActive).ToArray();
        if (!activeWebhooks.Any())
        {
            return;
        }

        var @operator = await _userService.GetOperatorAsync(operatorId);

        var dataObject = DataObjectBuilder
            .New(events, @operator, flag.UpdatedAt)
            .AddResourceDescriptor(resourceDescriptor)
            .AddFeatureFlag(flag)
            .AddChanges(changes);

        foreach (var webhook in activeWebhooks)
        {
            var delivery = await _webhookSender.SendAsync(webhook, dataObject);

            webhook.LastDelivery = new LastDelivery(delivery);
            await _webhookService.UpdateAsync(webhook);
        }
    }

    public async Task HandleAsync(Segment segment, DataChange dataChange, Guid operatorId)
    {
        string[] events;
        string[] changes;

        if (dataChange.IsCreation())
        {
            events = SegmentCreatedEvents;
            changes = new[] { $"Created Segment: ${segment.Name}" };
        }
        else if (dataChange.IsDeletion())
        {
            events = SegmentDeletedEvents;
            changes = new[] { $"Deleted Segment: ${segment.Name}" };
        }
        else
        {
            var original =
                JsonSerializer.Deserialize<Segment>(dataChange.Previous, ReusableJsonSerializerOptions.Web);
            var current =
                JsonSerializer.Deserialize<Segment>(dataChange.Current, ReusableJsonSerializerOptions.Web);

            var instructions = SegmentComparer.Compare(original, current).ToArray();
            events = instructions
                .Select(x => WebhookEvents.SegmentEvents.FromInstructionKind(x.Kind))
                .Distinct()
                .ToArray();
            changes = instructions
                .Select(x => InstructionDescriptor.Describe(x, original, current))
                .Distinct()
                .ToArray();
        }

        var resourceDescriptor = await _environmentService.GetResourceDescriptorAsync(segment.EnvId);
        var webhooks = await _webhookService.GetByEventsAsync(resourceDescriptor.Organization.Id, events);

        var activeWebhooks = webhooks.Where(x => x.IsActive).ToArray();
        if (!activeWebhooks.Any())
        {
            return;
        }

        var @operator = await _userService.GetOperatorAsync(operatorId);
        var flagReferences = await _segmentService.GetFlagReferencesAsync(segment.EnvId, segment.Id);

        var dataObject = DataObjectBuilder
            .New(events, @operator, segment.UpdatedAt)
            .AddResourceDescriptor(resourceDescriptor)
            .AddSegment(segment, flagReferences)
            .AddChanges(changes);

        foreach (var webhook in activeWebhooks)
        {
            var delivery = await _webhookSender.SendAsync(webhook, dataObject);

            webhook.LastDelivery = new LastDelivery(delivery);
            await _webhookService.UpdateAsync(webhook);
        }
    }
}