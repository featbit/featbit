using Application.Caches;
using Domain.Environments;

namespace Application.Environments;

public class OnSecretDeleted : INotification
{
    public Secret Secret { get; }

    public OnSecretDeleted(Secret secret)
    {
        Secret = secret;
    }
}

public class OnSecretDeletedHandler : INotificationHandler<OnSecretDeleted>
{
    private readonly ICacheService _cache;

    public OnSecretDeletedHandler(ICacheService cache)
    {
        _cache = cache;
    }

    public async Task Handle(OnSecretDeleted notification, CancellationToken cancellationToken)
    {
        await _cache.DeleteSecretAsync(notification.Secret);
    }
}