using Application.Caches;
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

public class OnEnvironmentAddedHandler : INotificationHandler<OnEnvironmentAdded>
{
    private readonly IEnvironmentService _envService;
    private readonly ICacheService _cache;

    public OnEnvironmentAddedHandler(IEnvironmentService envService, ICacheService cache)
    {
        _cache = cache;
        _envService = envService;
    }

    public async Task Handle(OnEnvironmentAdded notification, CancellationToken cancellationToken)
    {
        var env = notification.Environment;

        // add secret cache
        var resourceDescriptor = await _envService.GetResourceDescriptorAsync(env.Id);
        foreach (var secret in env.Secrets)
        {
            await _cache.UpsertSecretAsync(resourceDescriptor, secret);
        }
    }
}