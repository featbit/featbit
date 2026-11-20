using Application.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateVariationsPayload : ResourceChangeRequest
{
    /// <summary>
    /// The revision ID of the feature flag for optimistic concurrency control
    /// </summary>
    public Guid Revision { get; set; }

    /// <summary>
    /// The collection of variations (different values the feature flag can return)
    /// </summary>
    public ICollection<Variation> Variations { get; set; }
}

public class UpdateVariations : UpdateVariationsPayload, IRequest<Guid>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public UpdateVariations(Guid workspaceId, Guid orgId, Guid envId, string key, UpdateVariationsPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;
        Key = key;

        Revision = payload.Revision;
        Variations = payload.Variations;
        Comment = payload.Comment;
    }
}

public class UpdateVariationsValidator : AbstractValidator<UpdateVariations>
{
    public UpdateVariationsValidator()
    {
        RuleFor(x => x.Variations)
            .NotEmpty()
            .Must(variations => variations.All(variation => variation.IsValid()))
            .WithErrorCode(ErrorCodes.Invalid("variations"));
    }
}

public class UpdateVariationsHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateVariations, Guid>
{
    public async ValueTask<Guid> Handle(UpdateVariations request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        if (!flag.Revision.Equals(request.Revision))
        {
            throw new ConflictException(nameof(FeatureFlag), flag.Id);
        }

        var dataChange = flag.UpdateVariations(request.Variations, currentUser.Id);
        await service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag,
            request.WorkspaceId,
            request.OrgId,
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: request.Comment
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}
