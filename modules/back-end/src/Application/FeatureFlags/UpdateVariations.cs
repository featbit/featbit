using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateVariations : IRequest<Guid>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public ICollection<Variation> Variations { get; set; }

    public Guid Revision { get; set; }
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
    public async Task<Guid> Handle(UpdateVariations request, CancellationToken cancellationToken)
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
            Operations.Update,
            dataChange,
            currentUser.Id,
            comment: "Updated variations"
        );
        await publisher.Publish(notification, cancellationToken);

        return flag.Revision;
    }
}