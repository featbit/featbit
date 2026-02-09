using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateTargeting : IRequest<Guid>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Revision { get; set; }

    public string Key { get; set; }

    public FlagTargeting Targeting { get; set; }

    public string Comment { get; set; }
}

public class UpdateTargetingHandler(
    IFeatureFlagService flagService,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateTargeting, Guid>
{
    public async Task<Guid> Handle(UpdateTargeting request, CancellationToken cancellationToken)
    {
        var flag = await flagService.GetAsync(request.EnvId, request.Key);
        if (!flag.Revision.Equals(request.Revision))
        {
            throw new ConflictException(nameof(FeatureFlag), flag.Id);
        }

        var dataChange = flag.UpdateTargeting(request.Targeting, currentUser.Id);
        await flagService.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: request.Comment
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}