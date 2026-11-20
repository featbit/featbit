using Domain.FeatureFlags;
using Domain.Resources;

namespace Application.FeatureFlags;

/// <summary>Server-derived copy checks shared by preview and execution.</summary>
public class FlagCopyPrecheck(
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IResourceServiceV2 resourceService)
{
    public async Task<ICollection<CopyToEnvPrecheckResult>> CheckAsync(ICollection<FeatureFlag> flags, Guid targetEnvId)
    {
        var targetFlagKeys = flags.Select(x => x.Key).ToArray();

        var duplicateKeys =
        (
            await flagService.FindManyAsync(x => x.EnvId == targetEnvId && targetFlagKeys.Contains(x.Key))
        ).Select(x => x.Key).ToArray();

        var targetEnvRN = await resourceService.GetRNAsync(targetEnvId, ResourceTypes.Env);
        var targetEnvProperties = await endUserService.GetPropertiesAsync(targetEnvId);

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
