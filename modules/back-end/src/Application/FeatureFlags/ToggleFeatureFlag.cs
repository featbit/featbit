using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class ToggleFeatureFlag : IRequest<bool>
{
    public Guid EnvId { get; set; }
    
    public string Key { get; set; }
}

public class ToggleFeatureFlagHandler : IRequestHandler<ToggleFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;
    private readonly IAuditLogService _auditLogService;

    public ToggleFeatureFlagHandler(
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

    public async Task<bool> Handle(ToggleFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.Toggle(_currentUser.Id);
        await _service.UpdateAsync(flag);

        // write audit log
        var auditLog = AuditLog.ForUpdate(flag, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return true;
    }
}