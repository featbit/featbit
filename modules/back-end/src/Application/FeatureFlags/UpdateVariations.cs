using Application.Bases;
using Application.Users;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateVariations : IRequest<bool>
{
    public Guid Id { get; set; }

    public string VariationType { get; set; }

    public ICollection<Variation> Variations { get; set; }
}

public class UpdateVariationsValidator : AbstractValidator<UpdateVariations>
{
    public UpdateVariationsValidator()
    {
        RuleFor(x => x.VariationType)
            .Must(VariationTypes.IsDefined).WithErrorCode(ErrorCodes.InvalidVariationType);
    }
}

public class UpdateVariationsHandler : IRequestHandler<UpdateVariations, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public UpdateVariationsHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(UpdateVariations request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.UpdateVariations(request.VariationType, request.Variations, _currentUser.Id);

        await _service.UpdateAsync(flag);

        return true;
    }
}