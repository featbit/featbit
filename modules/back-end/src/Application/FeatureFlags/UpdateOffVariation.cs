using Application.AuditLogs;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateOffVariationPayload : ResourceChangeRequest
{
    /// <summary>
    /// The revision ID of the feature flag for optimistic concurrency control
    /// </summary>
    public Guid Revision { get; set; }

    /// <summary>
    /// The ID of the variation to serve when the feature flag is disabled
    /// </summary>
    public string OffVariationId { get; set; }
}

public class UpdateOffVariation : UpdateOffVariationPayload, IRequest<Guid>
{
    public Guid WorkspaceId { get; set; }

    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public UpdateOffVariation(Guid workspaceId, Guid orgId, Guid envId, string key, UpdateOffVariationPayload payload)
    {
        WorkspaceId = workspaceId;
        OrgId = orgId;
        EnvId = envId;
        Key = key;

        Revision = payload.Revision;
        OffVariationId = payload.OffVariationId;
        Comment = payload.Comment;
    }
}

public class UpdateOffVariationValidator : AbstractValidator<UpdateOffVariation>
{
    public UpdateOffVariationValidator()
    {
        RuleFor(x => x.OffVariationId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("offVariationId"));
    }
}

public class UpdateOffVariationHandler(
    IFeatureFlagService service,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<UpdateOffVariation, Guid>
{
    public async Task<Guid> Handle(UpdateOffVariation request, CancellationToken cancellationToken)
    {
        var flag = await service.GetAsync(request.EnvId, request.Key);
        if (!flag.Revision.Equals(request.Revision))
        {
            throw new ConflictException(nameof(FeatureFlag), flag.Id);
        }

        var dataChange = flag.UpdateOffVariation(request.OffVariationId, currentUser.Id);
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
