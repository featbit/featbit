using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.SemanticPatch;

namespace Application.FeatureFlags;

public class UpdateTargetingPayload
{
    /// <summary>
    /// Current revision of the feature flag, used for optimistic concurrency control.
    /// The update will be rejected if the revision does not match the latest revision of the flag, indicating that the flag has been modified since it was last retrieved.
    /// </summary>
    public Guid Revision { get; set; }

    /// <summary>
    /// The key of the feature flag
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The new flag targeting
    /// </summary>
    public FlagTargeting Targeting { get; set; }

    /// <summary>
    /// Optional comment describing the targeting change
    /// </summary>
    public string Comment { get; set; }
}

public class UpdateTargeting : UpdateTargetingPayload, IRequest<Guid>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

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

public class UpdateTargetingHandler(
    IFeatureFlagService flagService,
    IResourceService resourceService,
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

        await CheckPermissionsAsync();

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

        async Task CheckPermissionsAsync()
        {
            var instructions = FlagComparer.Compare(dataChange).ToArray();
            List<string> requiredPermissions = [];

            if (instructions.Any(x => FlagInstructionKind.UpdateDefaultRuleKinds.Contains(x.Kind)))
            {
                requiredPermissions.Add(Permissions.UpdateFlagDefaultRule);
            }

            if (instructions.Any(x => FlagInstructionKind.UpdateTargetUsersKinds.Contains(x.Kind)))
            {
                requiredPermissions.Add(Permissions.UpdateFlagIndividualTargeting);
            }

            if (instructions.Any(x => FlagInstructionKind.UpdateRuleKinds.Contains(x.Kind)))
            {
                requiredPermissions.Add(Permissions.UpdateFlagTargetingRules);
            }

            if (requiredPermissions.Count == 0)
            {
                return;
            }

            var flagRn = await resourceService.GetFlagRnAsync(flag.EnvId, flag.Key);
            if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(request.Permissions, flagRn, permission)))
            {
                throw new ForbiddenException();
            }
        }
    }
}