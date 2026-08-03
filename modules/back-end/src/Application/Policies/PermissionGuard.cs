using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.Policies;

public class PermissionGuard(IResourceService resourceService) : IPermissionGuard
{
    public Task EnsureFlagChangeAllowedAsync(FeatureFlag flag, DataChange change, PolicyStatement[] permissions) =>
        EnsureAllowedAsync(
            FlagComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => resourceService.GetFlagRnAsync(flag.EnvId, flag.Key)
        );

    public Task EnsureSegmentChangeAllowedAsync(Segment segment, DataChange change, PolicyStatement[] permissions) =>
        EnsureAllowedAsync(
            SegmentComparer.Compare(change).Select(instruction => instruction.Permission),
            permissions,
            () => resourceService.GetSegmentRnAsync(segment.EnvId, segment.Id)
        );

    private static async Task EnsureAllowedAsync(
        IEnumerable<string> instructionPermissions,
        PolicyStatement[] policies,
        Func<Task<string>> resourceNameFactory)
    {
        var requiredPermissions = instructionPermissions
            .Where(permission => !string.IsNullOrEmpty(permission))
            .ToHashSet();

        if (requiredPermissions.Count == 0)
        {
            return;
        }

        var rn = await resourceNameFactory();
        if (string.IsNullOrEmpty(rn))
        {
            throw new ForbiddenException();
        }

        if (requiredPermissions.Any(permission => !PolicyHelper.IsAllowed(policies, rn, permission)))
        {
            throw new ForbiddenException();
        }
    }
}
