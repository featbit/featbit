using Application.Bases;
using Application.Users;

namespace Application.FeatureFlags;

public class UpdateSetting : IRequest<bool>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public bool IsEnabled { get; set; }

    public string DisabledVariationId { get; set; }
}

public class UpdateSettingValidator : AbstractValidator<UpdateSetting>
{
    public UpdateSettingValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
    }
}

public class UpdateSettingHandler : IRequestHandler<UpdateSetting, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;

    public UpdateSettingHandler(IFeatureFlagService service, ICurrentUser currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    public async Task<bool> Handle(UpdateSetting request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        flag.UpdateSetting(request.Name, request.IsEnabled, request.DisabledVariationId, _currentUser.Id);

        await _service.UpdateAsync(flag);

        return true;
    }
}