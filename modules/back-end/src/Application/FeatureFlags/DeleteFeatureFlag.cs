using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class DeleteFeatureFlag : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }
}

public class DeleteFeatureFlagHandler : IRequestHandler<DeleteFeatureFlag, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly IPublisher _publisher;
    private readonly ICurrentUser _currentUser;
    private readonly IAuditLogService _auditLogService;

    public DeleteFeatureFlagHandler(
        IFeatureFlagService service,
        IPublisher publisher,
        ICurrentUser currentUser,
        IAuditLogService auditLogService)
    {
        _service = service;
        _publisher = publisher;
        _currentUser = currentUser;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(DeleteFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        if (!flag.IsArchived)
        {
            throw new BusinessException(ErrorCodes.CannotDeleteUnArchivedFeatureFlag);
        }

        await _service.DeleteAsync(flag.Id);

        // write audit log
        var auditLog = AuditLog.ForRemove(flag, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag delete notification
        await _publisher.Publish(new OnFeatureFlagDeleted(request.EnvId, flag.Id), cancellationToken);

        return true;
    }
}