using Application.Users;

namespace Application.FeatureFlags;

public class RestoreFeatureFlag : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class UnArchiveFeatureFlagHandler : IRequestHandler<RestoreFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public UnArchiveFeatureFlagHandler(IFeatureFlagService service, ICurrentUser currentUser, IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(RestoreFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.UnArchive(_currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return true;
    }
}