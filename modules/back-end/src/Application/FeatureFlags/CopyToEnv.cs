using Application.Users;
using Domain.AuditLogs;

namespace Application.FeatureFlags;

public class CopyToEnv : IRequest<CopyToEnvResult>
{
    public Guid TargetEnvId { get; set; }

    public ICollection<Guid> FlagIds { get; set; } = Array.Empty<Guid>();
}

public class CopyToEnvHandler : IRequestHandler<CopyToEnv, CopyToEnvResult>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;
    private readonly IAuditLogService _auditLogService;

    public CopyToEnvHandler(
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

    public async Task<CopyToEnvResult> Handle(CopyToEnv request, CancellationToken cancellationToken)
    {
        // get all flags that will be copied
        var flags = await _service.FindManyAsync(x => request.FlagIds.Contains(x.Id));

        // ignore flags whose key has been used in target env
        var flagKeys = flags.Select(x => x.Key);
        var duplicateKeys =
        (
            await _service.FindManyAsync(x => x.EnvId == request.TargetEnvId && flagKeys.Contains(x.Key))
        ).Select(x => x.Key);

        // copy flags
        var targetFlags = flags.Where(x => !duplicateKeys.Contains(x.Key)).ToArray();
        foreach (var targetFlag in targetFlags)
        {
            targetFlag.CopyToEnv(request.TargetEnvId, _currentUser.Id);

            await _service.AddOneAsync(targetFlag);

            // write audit log
            var auditLog = AuditLog.ForCreate(targetFlag, _currentUser.Id);
            await _auditLogService.AddOneAsync(auditLog);

            // publish on feature flag change notification
            await _publisher.Publish(new OnFeatureFlagChanged(targetFlag), cancellationToken);
        }

        var result = new CopyToEnvResult(targetFlags.Length, duplicateKeys);
        return result;
    }
}