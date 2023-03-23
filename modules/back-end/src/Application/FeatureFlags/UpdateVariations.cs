using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateVariations : IRequest<bool>
{
    public Guid EnvId { get; set; }
    
    public string Key { get; set; }

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
    private readonly IPublisher _publisher;
    private readonly IAuditLogService _auditLogService;

    public UpdateVariationsHandler(
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

    public async Task<bool> Handle(UpdateVariations request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateVariations(request.VariationType, request.Variations, _currentUser.Id);
        await _service.UpdateAsync(flag);

        // write audit log
        var auditLog = AuditLog.ForUpdate(flag, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return true;
    }
}