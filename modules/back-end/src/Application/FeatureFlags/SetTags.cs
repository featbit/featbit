using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class SetTags : IRequest<bool>
{
    public Guid EnvId { get; set; }
    
    public string Key { get; set; }

    public ICollection<string> Tags { get; set; }
}

public class SetTagsHandler : IRequestHandler<SetTags, bool>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IAuditLogService _auditLogService;

    public SetTagsHandler(IFeatureFlagService service, ICurrentUser currentUser, IAuditLogService auditLogService)
    {
        _service = service;
        _currentUser = currentUser;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(SetTags request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.SetTags(request.Tags, _currentUser.Id);

        // write audit log
        var auditLog = AuditLog.ForUpdate(flag, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        await _service.UpdateAsync(flag);
        return true;
    }
}