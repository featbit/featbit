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

    public CopyToEnvHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
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

            // publish on feature flag change notification
            var dataChange = new DataChange(null).To(targetFlag);
            var notification =
                new OnFeatureFlagChanged(targetFlag, Operations.Create, dataChange, _currentUser.Id);
            await _publisher.Publish(notification, cancellationToken);
        }

        var result = new CopyToEnvResult(targetFlags.Length, duplicateKeys);
        return result;
    }
}