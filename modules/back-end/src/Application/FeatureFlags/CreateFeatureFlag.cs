using Application.Bases;
using Application.Users;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class CreateFeatureFlag : IRequest<FeatureFlag>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }
}

public class CreateFeatureFlagValidator : AbstractValidator<CreateFeatureFlag>
{
    public CreateFeatureFlagValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.FeatureFlagKeyIsRequired);
    }
}

public class CreateFeatureFlagHandler : IRequestHandler<CreateFeatureFlag, FeatureFlag>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public CreateFeatureFlagHandler(IFeatureFlagService service, ICurrentUser currentUser, IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<FeatureFlag> Handle(CreateFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = new FeatureFlag(request.EnvId, request.Name, request.Key, _currentUser.Id);
        await _service.AddOneAsync(flag);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return flag;
    }
}