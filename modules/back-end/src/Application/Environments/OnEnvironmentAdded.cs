using Application.Caches;
using Domain.Messages;
using Microsoft.Extensions.Configuration;
using Environment = Domain.Environments.Environment;

namespace Application.Environments;

public class OnEnvironmentAdded : INotification
{
    public Environment Environment { get; }

    public OnEnvironmentAdded(Environment environment)
    {
        Environment = environment;
    }
}

public class OnEnvironmentAddedHandler(
    IEnvironmentService envService,
    ICacheService cache,
    IConfiguration configuration,
    IMessageProducer messageProducer)
    : INotificationHandler<OnEnvironmentAdded>
{
    public async Task Handle(OnEnvironmentAdded notification, CancellationToken cancellationToken)
    {
        var env = notification.Environment;

        // add secret cache
        var resourceDescriptor = await envService.GetResourceDescriptorAsync(env.Id);
        foreach (var secret in env.Secrets)
        {
            await cache.UpsertSecretAsync(resourceDescriptor, secret);
            if (configuration.UseControlPlane())
            {
                var message = ControlPlaneSecretHelpers.CreateAddMessage(resourceDescriptor, secret);
                await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneSecretChange, message);
            }
        }
    }
}