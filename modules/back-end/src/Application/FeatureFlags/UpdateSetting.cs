using Application.Bases;
using Application.Users;
using Domain.AuditLogs;

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
    private readonly IPublisher _publisher;
    private readonly IAuditLogService _auditLogService;

    public UpdateSettingHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher,
        IAuditLogService auditLogService)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(UpdateSetting request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.Id);
        var dataChange = flag.UpdateSetting(request.Name, request.IsEnabled, request.DisabledVariationId, _currentUser.Id);
        await _service.UpdateAsync(flag);

        // write audit log
        var auditLog = AuditLog.ForUpdate(flag, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return true;
    }
}