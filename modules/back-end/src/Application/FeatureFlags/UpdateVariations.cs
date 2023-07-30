using Application.Bases;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class UpdateVariations : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public ICollection<Variation> Variations { get; set; }
}

public class UpdateVariationsValidator : AbstractValidator<UpdateVariations>
{
    public UpdateVariationsValidator()
    {
        RuleFor(x => x.Variations)
            .NotEmpty()
            .Must(variations => variations.All(variation => variation.IsValid()))
            .WithErrorCode(ErrorCodes.Invalid("variations"));
    }
}

public class UpdateVariationsHandler : IRequestHandler<UpdateVariations, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly IFlagRevisionService _flagRevisionService;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;
    private readonly IAuditLogService _auditLogService;

    public UpdateVariationsHandler(
        IFeatureFlagService service,
        IFlagRevisionService flagRevisionService,
        ICurrentUser currentUser,
        IPublisher publisher,
        IAuditLogService auditLogService)
    {
        _service = service;
        _flagRevisionService = flagRevisionService;
        _currentUser = currentUser;
        _publisher = publisher;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(UpdateVariations request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateVariations(request.Variations, _currentUser.Id);
        
        var flagRevision = await _flagRevisionService.CreateForFlag(flag, null, _currentUser.Id);
        flag.Version = flagRevision.Version;
        await _service.UpdateAsync(flag);

        // write audit log
        var auditLog = AuditLog.ForUpdate(flag, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return true;
    }
}