using Application.Caches;
using Domain.Environments;
using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Application.Environments;

public class OnSecretAdded : INotification
{
    public Guid EnvId { get; }

    public Secret Secret { get; }

    public OnSecretAdded(Guid envId, Secret secret)
    {
        EnvId = envId;
        Secret = secret;
    }
}

public class OnSecretAddedHandler(
    ICacheService cache,
    IEnvironmentService envService,
    IConfiguration configuration,
    IMessageProducer messageProducer)
    : INotificationHandler<OnSecretAdded>
{
    public async Task Handle(OnSecretAdded notification, CancellationToken cancellationToken)
    {
        var resourceDescriptor = await envService.GetResourceDescriptorAsync(notification.EnvId);

        await cache.UpsertSecretAsync(resourceDescriptor, notification.Secret);

        if (configuration.UseControlPlane())
        {
            var message = ControlPlaneSecretHelpers.CreateAddMessage(resourceDescriptor, notification.Secret);
            await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneSecretChange, message);
        }
    }
}