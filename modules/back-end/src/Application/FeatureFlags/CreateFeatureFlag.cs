using Application.Bases;
using Application.Users;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class CreateFeatureFlag : IRequest<FeatureFlag>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }
}

public class CreateFeatureFlagValidator : AbstractValidator<CreateFeatureFlag>
{
    public CreateFeatureFlagValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class CreateFeatureFlagHandler : IRequestHandler<CreateFeatureFlag, FeatureFlag>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public CreateFeatureFlagHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<FeatureFlag> Handle(CreateFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = new FeatureFlag(request.EnvId, request.Name, _currentUser.Id);
        await _service.AddAsync(flag);

        return flag;
    }
}