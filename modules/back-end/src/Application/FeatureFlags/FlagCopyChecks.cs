using Application.Bases.Exceptions;
using Application.Environments;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;

namespace Application.FeatureFlags;

public sealed record CopyToEnvContext(
    Guid OrgId,
    Guid SourceEnvId,
    Guid TargetEnvId,
    ICollection<Guid> FlagIds,
    PolicyStatement[] Permissions
);

public class FlagCopyChecks(
    EnvironmentPermissionGuard envGuard,
    IFeatureFlagService flagService,
    IEndUserService endUserService,
    IResourceServiceV2 resourceService)
{
    public async Task<ICollection<FeatureFlag>> EnsureCopyAllowedAsync(CopyToEnvContext context)
    {
        var sourceEnvRn = await envGuard.EnsureAccessAsync(context.OrgId, context.SourceEnvId, context.Permissions);
        await envGuard.EnsureAccessAsync(context.OrgId, context.TargetEnvId, context.Permissions);

        var distinctIds = context.FlagIds.Distinct().ToArray();
        var flags = await flagService.FindManyAsync(x => x.EnvId == context.SourceEnvId && distinctIds.Contains(x.Id));

        foreach (var flag in flags)
        {
            var flagRn = $"{sourceEnvRn}:flag/{flag.Key}";
            if (flag.Tags is { Length: > 0 })
            {
                flagRn += $";{string.Join(",", flag.Tags)}";
            }

            if (!PolicyHelper.IsAllowed(context.Permissions, flagRn, Permissions.CopyFlagTo))
            {
                throw new ForbiddenException();
            }
        }

        return flags;
    }

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
