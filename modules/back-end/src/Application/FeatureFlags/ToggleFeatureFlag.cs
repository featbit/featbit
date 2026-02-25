using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class ToggleFeatureFlag : IRequest<Guid>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public bool Status { get; set; }
}

public class ToggleFeatureFlagHandler : IRequestHandler<ToggleFeatureFlag, Guid>
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

    public async Task<Guid> Handle(ToggleFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        if (flag.IsEnabled == request.Status)
        {
            return flag.Revision;
        }

        var dataChange = flag.Toggle(_currentUser.Id, request.Status);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, Operations.Update, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}