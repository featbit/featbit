using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class UpdateSetting : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

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
    private readonly IPublisher _publisher;

    public UpdateSettingHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(UpdateSetting request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateSetting(request.Name, request.Description, request.IsEnabled, request.DisabledVariationId, _currentUser.Id);
        await _service.UpdateAsync(flag);

        // publish on feature flag change notification
        var notification = new OnFeatureFlagChanged(flag, Operations.Update, dataChange, _currentUser.Id);
        await _publisher.Publish(notification, cancellationToken);

        return true;
    }
}