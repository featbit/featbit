using Application.Caches;
using Domain.Environments;
using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Application.Environments;

public class OnSecretDeleted : INotification
{
    public Secret Secret { get; }

    public OnSecretDeleted(Secret secret)
    {
        Secret = secret;
    }
}

public class OnSecretDeletedHandler(ICacheService cache, IConfiguration configuration, IMessageProducer messageProducer)
    : INotificationHandler<OnSecretDeleted>
{
    public async Task Handle(OnSecretDeleted notification, CancellationToken cancellationToken)
    {
        await cache.DeleteSecretAsync(notification.Secret);
        if (configuration.UseControlPlane())
        {
            var message = ControlPlaneSecretHelpers.CreateDeleteMessage(notification.Secret);
            await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneSecretChange, message);
        }
    }
}