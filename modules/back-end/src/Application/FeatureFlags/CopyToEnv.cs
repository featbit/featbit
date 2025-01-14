using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class CopyToEnv : IRequest<CopyToEnvResult>
{
    public Guid TargetEnvId { get; set; }

    public CopyToEnvPrecheckResult[] PrecheckResults { get; set; } = [];

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
        var flags = await _service.FindManyAsync(x => request.FlagIds.Contains(x.Id));
        var precheckResults = request.PrecheckResults;

        foreach (var flag in flags)
        {
            await CopyAsync(flag);
        }

        return new CopyToEnvResult(flags.Count);

        async Task CopyAsync(FeatureFlag flag)
        {
            var precheckResult = precheckResults.FirstOrDefault(x => x.Id == flag.Id);
            if (precheckResult is not { KeyCheck: true })
            {
                return;
            }

            flag.CopyToEnv(request.TargetEnvId, _currentUser.Id, keepRules: precheckResult.TargetRuleCheck);
            await _service.AddOneAsync(flag);

            // publish on feature flag change notification
            var dataChange = new DataChange(null).To(flag);
            var notification =
                new OnFeatureFlagChanged(flag, Operations.Create, dataChange, _currentUser.Id);
            await _publisher.Publish(notification, cancellationToken);
        }
    }
}