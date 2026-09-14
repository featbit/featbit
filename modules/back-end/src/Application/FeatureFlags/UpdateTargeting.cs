using Application.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;

namespace Application.FeatureFlags;

public class UpdateTargetingPayload : ResourceChangeRequest
{
    /// <summary>
    /// Current revision of the feature flag, used for optimistic concurrency control.
    /// The update will be rejected if the revision does not match the latest revision of the flag, indicating that the flag has been modified since it was last retrieved.
    /// </summary>
    public Guid Revision { get; set; }

    /// <summary>
    /// The new flag targeting
    /// </summary>
    public FlagTargeting Targeting { get; set; }
}

public class UpdateTargeting : UpdateTargetingPayload, IRequest<Guid>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public PolicyStatement[] Permissions { get; set; }

    public UpdateTargeting(
        Guid orgId,
        Guid envId,
        string key,
        UpdateTargetingPayload payload,
        PolicyStatement[] permissions)
    {
        OrgId = orgId;
        EnvId = envId;
        Key = key;
        Revision = payload.Revision;
        Targeting = payload.Targeting;
        Comment = payload.Comment;
        Permissions = permissions;
    }
}

public class UpdateTargetingValidator : AbstractValidator<UpdateTargeting>
{
    public UpdateTargetingValidator()
    {
        RuleFor(x => x.Targeting)
            .NotNull().WithErrorCode(ErrorCodes.Required("targeting"));
    }
}

public class UpdateTargetingHandler(
    IFeatureFlagService flagService,
    IPermissionGuard permissionGuard,
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

        FlagTargetingValidator.EnsureValid(request.Targeting, flag.Variations);

        var dataChange = flag.UpdateTargeting(request.Targeting, currentUser.Id);

        await permissionGuard.EnsureFlagChangeAllowedAsync(flag, dataChange, request.Permissions);

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
