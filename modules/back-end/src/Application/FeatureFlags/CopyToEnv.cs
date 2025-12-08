using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Resources;

namespace Application.FeatureFlags;

public class CopyToEnv : IRequest<CopyToEnvResult>
{
    public Guid SourceEnvId { get; set; }

    public Guid TargetEnvId { get; set; }

    public CopyToEnvPrecheckResult[] PrecheckResults { get; set; } = [];

    public ICollection<Guid> FlagIds { get; set; } = Array.Empty<Guid>();
}

public class CopyToEnvHandler(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IResourceServiceV2 resourceService,
    ICurrentUser currentUser,
    IPublisher publisher)
    : IRequestHandler<CopyToEnv, CopyToEnvResult>
{
    public async Task<CopyToEnvResult> Handle(CopyToEnv request, CancellationToken cancellationToken)
    {
        var srcEnv = await GetSrcEnvAsync();

        var flags = await flagService.FindManyAsync(x => request.FlagIds.Contains(x.Id));
        var precheckResults = request.PrecheckResults;

        foreach (var flag in flags)
        {
            await CopyAsync(flag);
        }

        var newPropertiesToAdd = precheckResults.SelectMany(x => x.NewProperties).Distinct().ToArray();
        if (newPropertiesToAdd.Length > 0)
        {
            await endUserService.AddNewPropertiesAsync(request.TargetEnvId, newPropertiesToAdd);
        }

        return new CopyToEnvResult(flags.Count);

        async Task<string> GetSrcEnvAsync()
        {
            var rnString = await resourceService.GetRNAsync(request.SourceEnvId, ResourceTypes.Env);
            if (!RN.TryParse(rnString, out var props))
            {
                return rnString;
            }

            var project = props.FirstOrDefault(x => x.Type == ResourceTypes.Project);
            var env = props.FirstOrDefault(x => x.Type == ResourceTypes.Env);

            return $"{project?.Key}/{env?.Key}";
        }

        async Task CopyAsync(FeatureFlag flag)
        {
            var precheckResult = precheckResults.FirstOrDefault(x => x.Id == flag.Id);
            if (precheckResult is not { KeyCheck: true })
            {
                return;
            }

            flag.CopyToEnv(request.TargetEnvId, currentUser.Id, keepRules: precheckResult.TargetRuleCheck);
            await flagService.AddOneAsync(flag);

            // publish on feature flag change notification
            var dataChange = new DataChange(null).To(flag);
            var notification = new OnFeatureFlagChanged(
                flag, Operations.Create, dataChange, currentUser.Id, $"Copied from \"{srcEnv}\""
            );
            await publisher.Publish(notification, cancellationToken);
        }
    }
}