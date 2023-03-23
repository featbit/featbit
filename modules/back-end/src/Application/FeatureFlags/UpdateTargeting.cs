using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Application.FeatureFlags;

public class UpdateTargeting : IRequest<bool>
{
    public Guid EnvId { get; set; }
    
    public string Key { get; set; }

    public ICollection<TargetUser> TargetUsers { get; set; }

    public ICollection<TargetRule> Rules { get; set; }

    public Fallthrough Fallthrough { get; set; }

    public bool ExptIncludeAllTargets { get; set; }

    public string Comment { get; set; }
}

public class UpdateTargetingHandler : IRequestHandler<UpdateTargeting, bool>
{
    private readonly IFeatureFlagService _flagService;
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;

    public UpdateTargetingHandler(
        IFeatureFlagService flagService,
        IAuditLogService auditLogService,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _flagService = flagService;
        _auditLogService = auditLogService;
        _currentUser = currentUser;
        _publisher = publisher;
    }

    public async Task<bool> Handle(UpdateTargeting request, CancellationToken cancellationToken)
    {
        var flag = await _flagService.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.UpdateTargeting(
            request.TargetUsers,
            request.Rules,
            request.Fallthrough,
            request.ExptIncludeAllTargets,
            _currentUser.Id
        );

        await _flagService.UpdateAsync(flag);

        // write audit log
        var auditLog = AuditLog.ForUpdate(flag, dataChange, request.Comment, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return true;
    }
}