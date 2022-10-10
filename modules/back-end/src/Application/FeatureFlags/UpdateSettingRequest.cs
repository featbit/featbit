using Application.Bases;
using Application.Users;

namespace Application.FeatureFlags;

public class UpdateSettingRequest : IRequest<bool>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public bool IsEnabled { get; set; }

    public string DisabledVariationId { get; set; }
}

public class UpdateSettingRequestValidator : AbstractValidator<UpdateSettingRequest>
{
    public UpdateSettingRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class UpdateSettingRequestHandler : IRequestHandler<UpdateSettingRequest, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public UpdateSettingRequestHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(UpdateSettingRequest request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.UpdateSetting(request.Name, request.IsEnabled, request.DisabledVariationId, _currentUser.Id);

        await _service.UpdateAsync(flag);

        return true;
    }
}