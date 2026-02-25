using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class ArchiveFeatureFlag : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class ArchiveFeatureFlagHandler : IRequestHandler<ArchiveFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public ArchiveFeatureFlagHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(ArchiveFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        if (flag.IsArchived)
        {
            return true;
        }

        var dataChange = flag.Archive(_currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, Operations.Archive, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}