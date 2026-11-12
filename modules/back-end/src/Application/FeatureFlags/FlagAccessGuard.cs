#nullable enable
using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.FeatureFlags;
using Domain.Resources;

namespace Application.FeatureFlags;

/// <summary>Resolves flag environments inside the authorizing organization before evaluating policies.</summary>
public class FlagAccessGuard(IResourceService resourceService, IFeatureFlagService flagService)
{
    private async Task<string> GetEnvironmentRnAsync(Guid organizationId, Guid envId)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ForbiddenException();
        }

        var resource = await resourceService.GetEnvRnAsync(envId);
        if (resource == null || resource.OrganizationId != organizationId || string.IsNullOrWhiteSpace(resource.Rn))
        {
            throw new ForbiddenException();
        }

        return resource.Rn;
    }

    public async Task EnsureEnvironmentAccessAsync(Guid organizationId, Guid envId, PolicyStatement[] statements)
    {
        var rn = await GetEnvironmentRnAsync(organizationId, envId);
        EnsureAllowed(rn, statements, Permissions.CanAccessEnv);
    }

    private static void EnsureAllowed(string rn, PolicyStatement[] statements,
        string permission, string? flagKey = null, ICollection<string>? tags = null)
    {
        if (flagKey != null)
        {
            rn += $":flag/{flagKey}";
            if (tags is { Count: > 0 }) rn = RN.WithTags(rn, tags);
        }

        if (!PolicyHelper.IsAllowed(statements, rn, permission))
        {
            throw new ForbiddenException();
        }
    }

    public async Task<ICollection<FeatureFlag>> GetAuthorizedFlagsForCopyAsync(
        Guid orgId, Guid sourceEnvId, Guid targetEnvId, ICollection<Guid> ids, PolicyStatement[] statements)
    {
        var sourceRn = await GetEnvironmentRnAsync(orgId, sourceEnvId);
        EnsureAllowed(sourceRn, statements, Permissions.CanAccessEnv);
        var targetRn = await GetEnvironmentRnAsync(orgId, targetEnvId);
        EnsureAllowed(targetRn, statements, Permissions.CanAccessEnv);
        var distinctIds = ids.Distinct().ToArray();
        var sources = await flagService.FindManyAsync(x => distinctIds.Contains(x.Id) && x.EnvId == sourceEnvId);
        if (sources.Count != distinctIds.Length) throw new ForbiddenException();
        foreach (var flag in sources)
        {
            EnsureAllowed(sourceRn, statements, Permissions.CopyFlagTo, flag.Key, flag.Tags);
        }
        return sources;
    }
}
