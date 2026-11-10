#nullable enable
using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.Policies;

public class PermissionGuard(IResourceService resourceService) : IPermissionGuard
{
    public Task EnsureFlagChangeAllowedAsync(Guid organizationId, FeatureFlag flag, DataChange change, PolicyStatement[] permissions) =>
        EnsureAllowedAsync(
            organizationId,
            FlagComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => resourceService.GetFlagRnAsync(flag.EnvId, flag.Key)
        );

    public Task EnsureSegmentChangeAllowedAsync(Guid organizationId, Segment segment, DataChange change, PolicyStatement[] permissions) =>
        EnsureAllowedAsync(
            organizationId,
            SegmentComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => resourceService.GetSegmentRnAsync(segment.EnvId, segment.Id)
        );

    private static async Task EnsureAllowedAsync(
        Guid organizationId,
        IEnumerable<string> instructionPermissions,
        PolicyStatement[] policies,
        Func<Task<ResourceRn?>> resourceFactory)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ForbiddenException();
        }

        var resource = await resourceFactory();
        if (resource == null || resource.OrganizationId != organizationId || string.IsNullOrWhiteSpace(resource.Rn))
        {
            throw new ForbiddenException();
        }

        var requiredPermissions = instructionPermissions
            .Where(permission => !string.IsNullOrEmpty(permission))
            .ToHashSet();

        if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(policies, resource.Rn, permission)))
        {
            throw new ForbiddenException();
        }
    }
}
