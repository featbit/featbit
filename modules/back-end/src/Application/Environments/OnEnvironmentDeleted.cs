using Application.Caches;
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

public class OnEnvironmentDeletedHandler : INotificationHandler<OnEnvironmentDeleted>
{
    private readonly ICacheService _cache;

    public OnEnvironmentDeletedHandler(ICacheService cache)
    {
        _cache = cache;
    }

    public async Task Handle(OnEnvironmentDeleted notification, CancellationToken cancellationToken)
    {
        var env = notification.Environment;

        // delete secret cache
        foreach (var secret in env.Secrets)
        {
            await _cache.DeleteSecretAsync(secret);
        }
    }
}