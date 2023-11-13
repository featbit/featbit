using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateTargeting : IRequest<bool>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public FlagTargeting Targeting { get; set; }

    public string Comment { get; set; }
}

public class UpdateTargetingHandler : IRequestHandler<UpdateTargeting, bool>
{
    private readonly IFeatureFlagService _flagService;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public UpdateTargetingHandler(
        IFeatureFlagService flagService,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _flagService = flagService;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(UpdateTargeting request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateTargeting(request.Targeting, _currentUser.Id);
        await _flagService.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification =
            new OnFeatureFlagChanged(flag, Operations.Update, dataChange, _currentUser.Id, request.Comment);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}