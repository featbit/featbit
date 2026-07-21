using Application.Caches;
using Domain.Messages;
using Microsoft.Extensions.Configuration;
using Environment = Domain.Environments.Environment;

namespace Application.Environments;

public class OnEnvironmentDeleted : INotification
{
    public Environment Environment { get; }

    public OnEnvironmentDeleted(Environment environment)
    {
        Environment = environment;
    }
}

public class OnEnvironmentDeletedHandler(ICacheService cacheService, IMessageProducer messageProducer, IConfiguration configuration)
    : INotificationHandler<OnEnvironmentDeleted>
{
    public async Task Handle(OnEnvironmentDeleted notification, CancellationToken cancellationToken)
    {
        var env = notification.Environment;

        // delete secret cache
        foreach (var secret in env.Secrets)
        {
            await cacheService.DeleteSecretAsync(secret);
            if (configuration.UseControlPlane())
            {
                var message = ControlPlaneSecretHelpers.CreateDeleteMessage(secret);
                await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneSecretChange, message);
            }
        }
    }
}