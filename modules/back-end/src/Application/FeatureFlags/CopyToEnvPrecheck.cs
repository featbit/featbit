using Domain.FeatureFlags;
using Domain.Resources;

namespace Application.FeatureFlags;

public class CopyToEnvPrecheck : IRequest<ICollection<CopyToEnvPrecheckResult>>
{
    public Guid TargetEnvId { get; set; }

    public ICollection<Guid> FlagIds { get; set; } = Array.Empty<Guid>();
}

public class CopyToEnvPrecheckHandler(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IResourceServiceV2 resourceService)
    : IRequestHandler<CopyToEnvPrecheck, ICollection<CopyToEnvPrecheckResult>>
{
    public async Task<ICollection<CopyToEnvPrecheckResult>> Handle(
        CopyToEnvPrecheck request,
        CancellationToken cancellationToken)
    {
        var flags = await flagService.FindManyAsync(x => request.FlagIds.Contains(x.Id));
        var targetFlagKeys = flags.Select(x => x.Key).ToArray();

        var duplicateKeys =
        (
            await flagService.FindManyAsync(x => x.EnvId == request.TargetEnvId && targetFlagKeys.Contains(x.Key))
        ).Select(x => x.Key).ToArray();

        var targetEnvRN = await resourceService.GetRNAsync(request.TargetEnvId, ResourceTypes.Env);
        var targetEnvProperties = await endUserService.GetPropertiesAsync(request.TargetEnvId);

        var relatedSegments = await flagService.GetRelatedSegmentsAsync(flags);

        var results = new List<CopyToEnvPrecheckResult>();
        foreach (var flag in flags)
        {
            var result = new CopyToEnvPrecheckResult
            {
                Id = flag.Id,
                KeyCheck = !duplicateKeys.Contains(flag.Key),
                TargetUserCheck = flag.TargetUsers.Count == 0,
                TargetRuleCheck = FlagCopyHelper.IsRulesCopyable(flag.Rules, relatedSegments, targetEnvRN),
                NewProperties = FlagCopyHelper.GetNewProperties(flag.Rules, targetEnvProperties)
            };

            results.Add(result);
        }

        return results;
    }
}