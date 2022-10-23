using Application.Users;

namespace Application.FeatureFlags;

public class ArchiveFeatureFlag : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ArchiveFeatureFlagHandler : IRequestHandler<ArchiveFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public ArchiveFeatureFlagHandler(IFeatureFlagService service, ICurrentUser currentUser, IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(ArchiveFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.Archive(_currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return true;
    }
}