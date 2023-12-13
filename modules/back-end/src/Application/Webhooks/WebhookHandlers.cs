using System.Dynamic;
using Application.FeatureFlags;
using Domain.SemanticPatch;
using Domain.Webhooks;

namespace Application.Webhooks;

public class WebhookHandler : IWebhookHandler
{
    private static readonly string[] CreatedEvents = { WebhookEvents.FlagEvents.Created };
    private static readonly string[] DeletedEvents = { WebhookEvents.FlagEvents.Deleted };

    private readonly IWebhookService _webhookService;
    private readonly IWebhookSender _webhookSender;
    private readonly IEnvironmentService _environmentService;

    public WebhookHandler(
        IWebhookService webhookService,
        IWebhookSender webhookSender,
        IEnvironmentService environmentService)
    {
        _webhookService = webhookService;
        _webhookSender = webhookSender;
        _environmentService = environmentService;
    }

    public async Task HandleAsync(OnFeatureFlagChanged notification)
    {
        string[] events;

        var dataChange = notification.DataChange;
        if (dataChange.IsCreation())
        {
            events = CreatedEvents;
        }
        else if (dataChange.IsDeletion())
        {
            events = DeletedEvents;
        }
        else
        {
            var instructions = FlagComparer.Compare(dataChange).ToArray();
            events = instructions.Select(x => WebhookEvents.FlagEvents.FromInstructionKind(x.Kind)).ToArray();
        }

        var flag = notification.Flag;

        var resourceDescriptor = await _environmentService.GetResourceDescriptorAsync(flag.EnvId);
        var webhooks = await _webhookService.GetByEventsAsync(resourceDescriptor.Organization.Id, events);

        dynamic payloadData = ConstructPayloadData();
        foreach (var webhook in webhooks)
        {
            await _webhookSender.SendAsync(webhook, payloadData);
        }

        return;

        ExpandoObject ConstructPayloadData()
        {
            dynamic expando = new ExpandoObject();
            expando.@event = string.Join(',', events);

            expando.organization = new ExpandoObject();
            expando.organization.id = resourceDescriptor.Organization.Id;
            expando.organization.name = resourceDescriptor.Organization.Name;

            expando.project = new ExpandoObject();
            expando.project.id = resourceDescriptor.Project.Id;
            expando.project.name = resourceDescriptor.Project.Name;

            expando.environment = new ExpandoObject();
            expando.environment.id = resourceDescriptor.Environment.Id;
            expando.environment.name = resourceDescriptor.Environment.Name;

            expando.data = new ExpandoObject();
            expando.data.@object = flag;

            return expando;
        }
    }
}