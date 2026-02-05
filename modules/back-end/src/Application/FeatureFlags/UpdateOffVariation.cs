using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateOffVariation : IRequest<Guid>
{
    /// <summary>
    /// The ID of the environment the feature flag belongs to. Retrieved from the URL path.
    /// </summary>
    public Guid EnvId { get; set; }

    /// <summary>
    /// The unique key of the feature flag. Retrieved from the URL path.
    /// </summary>
    public string Key { get; set; }

    /// <summary>
    /// The revision ID of the feature flag for optimistic concurrency control
    /// </summary>
    public Guid Revision { get; set; }

    /// <summary>
    /// The ID of the variation to serve when the feature flag is disabled
    /// </summary>
    public string OffVariationId { get; set; }
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
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated off variation"
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}