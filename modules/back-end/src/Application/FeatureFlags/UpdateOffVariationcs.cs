using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateOffVariation : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

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

public class UpdateOffVariationHandler : IRequestHandler<UpdateOffVariation, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public UpdateOffVariationHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(UpdateOffVariation request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateOffVariation(request.OffVariationId, _currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(
            flag, 
            Operations.Update, 
            dataChange, 
            _currentUser.Id, 
            comment: "Updated off variation"
        );
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}