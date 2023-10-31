using Application.Users;
using Domain.AuditLogs;
using Domain.FlagRevisions;

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
    private readonly IFlagRevisionService _flagRevisionService;
    private readonly ICurrentUser _currentUser;
    private readonly IAuditLogService _auditLogService;

    public SetTagsHandler(
        IFeatureFlagService service,
        IFlagRevisionService flagRevisionService,
        ICurrentUser currentUser,
        IAuditLogService auditLogService)
    {
        _service = service;
        _flagRevisionService = flagRevisionService;
        _currentUser = currentUser;
        _auditLogService = auditLogService;
    }

    public async Task<bool> Handle(SetTags request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = flag.SetTags(request.Tags, _currentUser.Id);
        await _service.UpdateAsync(flag);

        // write audit log
        var auditLog = AuditLog.For(flag, Operations.Update, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // add flag revision
        var revision = new FlagRevision(flag, string.Empty);
        await _flagRevisionService.AddOneAsync(revision);

        return true;
    }
}