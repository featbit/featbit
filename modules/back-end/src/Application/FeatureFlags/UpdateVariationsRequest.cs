using Application.Bases;
using Application.Users;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateVariationsRequest : IRequest<bool>
{
    public Guid Id { get; set; }

    public string VariationType { get; set; }

    public ICollection<Variation> Variations { get; set; }
}

public class UpdateVariationsRequestValidator : AbstractValidator<UpdateVariationsRequest>
{
    public UpdateVariationsRequestValidator()
    {
        RuleFor(x => x.VariationType)
            .Must(VariationTypes.IsDefined).WithErrorCode(ErrorCodes.InvalidVariationType);
    }
}

public class UpdateVariationsHandler : IRequestHandler<UpdateVariationsRequest, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public UpdateVariationsHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(UpdateVariationsRequest request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.UpdateVariations(request.VariationType, request.Variations, _currentUser.Id);

        await _service.UpdateAsync(flag);

        return true;
    }
}