using Application.AuditLogs;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class RestoreFeatureFlag : ResourceChangeRequest, IRequest<bool>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public RestoreFeatureFlag(Guid workspaceId, Guid orgId, Guid envId, string key, ResourceChangeRequest payload = null)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;
        Key = key;

        Comment = payload?.Comment ?? string.Empty;
    }
}

public class RestoreFeatureFlagHandler : IRequestHandler<RestoreFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public RestoreFeatureFlagHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async ValueTask<bool> Handle(RestoreFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        if (!flag.IsArchived)
        {
            return true;
        }

        var dataChange = flag.Restore(_currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification =
            new OnFeatureFlagChanged(flag, request.WorkspaceId, request.OrgId, Operations.Restore, dataChange, _currentUser.Id, request.Comment);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}
