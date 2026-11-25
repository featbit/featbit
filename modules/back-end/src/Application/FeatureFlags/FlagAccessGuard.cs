using Application.Bases.Exceptions;
using Application.Environments;
using Domain.Policies;
using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class FlagAccessGuard(EnvironmentPermissionGuard environmentAccess, IFeatureFlagService flagService)
{
    public async Task<ICollection<FeatureFlag>> GetAuthorizedFlagsForCopyAsync(
        Guid orgId, Guid sourceEnvId, Guid targetEnvId, ICollection<Guid> ids, PolicyStatement[] statements)
    {
        var sourceRn = await environmentAccess.EnsureAccessAsync(orgId, sourceEnvId, statements);
        await environmentAccess.EnsureAccessAsync(orgId, targetEnvId, statements);
        var distinctIds = ids.Distinct().ToArray();
        var sources = await flagService.FindManyAsync(x => distinctIds.Contains(x.Id) && x.EnvId == sourceEnvId);
        if (sources.Count != distinctIds.Length) throw new ForbiddenException();
        foreach (var flag in sources)
        {
            var flagRn = $"{sourceRn}:flag/{flag.Key}";
            if (flag.Tags is { Length: > 0 }) flagRn += $";{string.Join(",", flag.Tags)}";

            if (!PolicyHelper.IsAllowed(statements, flagRn, Permissions.CopyFlagTo))
            {
                throw new ForbiddenException();
            }
        }
        return sources;
    }
}
