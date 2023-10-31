using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class ToggleFeatureFlag : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class ToggleFeatureFlagHandler : IRequestHandler<ToggleFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public ToggleFeatureFlagHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(ToggleFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.Toggle(_currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, Operations.Update, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}