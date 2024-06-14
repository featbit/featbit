using Application.Caches;
using Domain.Environments;

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

public class OnSecretAddedHandler : INotificationHandler<OnSecretAdded>
{
    private readonly ICacheService _cache;
    private readonly IEnvironmentService _envService;

    public OnSecretAddedHandler(ICacheService cache, IEnvironmentService envService)
    {
        _cache = cache;
        _envService = envService;
    }

    public async Task Handle(OnSecretAdded notification, CancellationToken cancellationToken)
    {
        var resourceDescriptor = await _envService.GetResourceDescriptorAsync(notification.EnvId);

        await _cache.UpsertSecretAsync(resourceDescriptor, notification.Secret);
    }
}