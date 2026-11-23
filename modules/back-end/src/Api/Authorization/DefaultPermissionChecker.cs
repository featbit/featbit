using Application.Services;
using Domain.Policies;
using Domain.Resources;

namespace Api.Authorization;

public class DefaultPermissionChecker(
    IResourcePermissionTargetResolver targetResolver,
    IRequestPermissions requestPermissions,
    ILogger<DefaultPermissionChecker> logger)
    : IPermissionChecker
{
    public async Task<bool> IsGrantedAsync(HttpContext httpContext, PermissionRequirement requirement)
    {
        var permission = requirement.PermissionName;

        var resources = Permissions.ResourceMap;
        if (!resources.TryGetValue(permission, out var resourceType))
        {
            logger.LogWarning("The permission '{Permission}' has no corresponding resourceType.", permission);
            return false;
        }

        var permissionTarget = await ResolvePermissionTargetAsync(permission, resourceType, httpContext.Request);
        if (string.IsNullOrWhiteSpace(permissionTarget?.Rn))
        {
            // failed to get resource RN, return false to be safe. This usually indicates bad requests, e.g. invalid or missing route parameters.
            return false;
        }

        // Ensure the resolved resource's organization context matches the request organization.
        if (resourceType != ResourceTypes.Workspace && permissionTarget.OrganizationId != httpContext.Request.OrganizationId())
        {
            return false;
        }

        // check if the user has the required permission on the resource
        var statements = await requestPermissions.GetAsync(httpContext);
        return PolicyHelper.IsAllowed(statements, permissionTarget.Rn, permission);
    }

    private async ValueTask<ResourcePermissionTarget?> ResolvePermissionTargetAsync(string permission, string resourceType, HttpRequest request)
    {
        var routeValues = request.RouteValues;

        return resourceType switch
        {
            ResourceTypes.Workspace => new ResourcePermissionTarget(RN.ForWorkspace(), null),
            ResourceTypes.Iam => new ResourcePermissionTarget(RN.ForIam(), request.OrganizationId()),
            ResourceTypes.AccessToken => new ResourcePermissionTarget(RN.ForAccessToken(), request.OrganizationId()),
            ResourceTypes.Organization => new ResourcePermissionTarget(RN.ForOrganization(), request.OrganizationId()),
            ResourceTypes.RelayProxy => new ResourcePermissionTarget(RN.ForRelayProxy(), request.OrganizationId()),
            ResourceTypes.Project => await ResolveProjectAsync(),
            ResourceTypes.Env => await ResolveEnvironmentAsync(),
            ResourceTypes.FeatureFlag => await ResolveFlagAsync(),
            ResourceTypes.Segment => await ResolveSegmentAsync(),
            _ => null
        };

        async Task<ResourcePermissionTarget?> ResolveProjectAsync()
        {
            if (permission == Permissions.CreateProject)
            {
                // `CreateProject` is a special case as it doesn't have projectId in route values.
                // It operates on organization level, so we can return project level wildcard.
                return new ResourcePermissionTarget("project/*", request.OrganizationId());
            }

            var routeValue = routeValues.TryGetValue("projectId", out var projectIdRouteValue)
                ? projectIdRouteValue
                : routeValues.TryGetValue("id", out var idRouteValue)
                    ? idRouteValue
                    : null;

            var projectIdString = routeValue?.ToString()!;
            if (!Guid.TryParse(projectIdString, out var projectId))
            {
                // invalid project id, return empty
                logger.LogWarning("Invalid projectId '{ProjectId}' in route values.", projectIdString);
                return null;
            }

            var projectTarget = await targetResolver.ResolveProjectAsync(projectId);
            if (projectTarget == null)
            {
                return null;
            }

            return permission == Permissions.CreateEnv
                // return env level wildcard for `CreateEnv` permission
                ? projectTarget with { Rn = $"{projectTarget.Rn}:env/*" }
                : projectTarget;
        }

        async Task<ResourcePermissionTarget?> ResolveEnvironmentAsync()
        {
            var routeValue = routeValues.TryGetValue("envId", out var envIdRouteValue)
                ? envIdRouteValue
                : routeValues.TryGetValue("id", out var idRouteValue)
                    ? idRouteValue
                    : null;

            var envIdString = routeValue?.ToString();
            if (!Guid.TryParse(envIdString, out var envId))
            {
                // invalid env id, return empty
                logger.LogWarning("Invalid envId '{EnvId}' in route values.", envIdString);
                return null;
            }

            var envTarget = await targetResolver.ResolveEnvironmentAsync(envId);
            return envTarget;
        }

        async Task<ResourcePermissionTarget?> ResolveFlagAsync()
        {
            if (!routeValues.TryGetValue("envId", out var envIdRouteValue) ||
                !Guid.TryParse(envIdRouteValue?.ToString(), out var envId))
            {
                // invalid or missing env id
                return null;
            }

            if (!routeValues.TryGetValue("key", out var keyRouteValue))
            {
                // missing key, return env level wildcard
                var envTarget = await targetResolver.ResolveEnvironmentAsync(envId);
                return envTarget == null || string.IsNullOrWhiteSpace(envTarget.Rn)
                    ? null : envTarget with { Rn = $"{envTarget.Rn}:flag/*" };
            }

            var key = keyRouteValue?.ToString()!;
            var flagTarget = await targetResolver.ResolveFlagAsync(envId, key);
            return flagTarget;
        }

        async Task<ResourcePermissionTarget?> ResolveSegmentAsync()
        {
            if (!routeValues.TryGetValue("envId", out var envIdRouteValue) ||
                !Guid.TryParse(envIdRouteValue?.ToString(), out var envId))
            {
                // invalid or missing env id, return empty
                return null;
            }

            if (!routeValues.TryGetValue("segmentId", out var segmentIdRouteValue))
            {
                // missing id, return env level wildcard
                var envTarget = await targetResolver.ResolveEnvironmentAsync(envId);
                return envTarget == null || string.IsNullOrWhiteSpace(envTarget.Rn)
                    ? null : envTarget with { Rn = $"{envTarget.Rn}:segment/*" };
            }

            if (!Guid.TryParse(segmentIdRouteValue?.ToString(), out var segmentId))
            {
                // invalid segment id, return empty
                logger.LogWarning("Invalid segmentId '{SegmentId}' in route values.", segmentIdRouteValue);
                return null;
            }

            var segmentTarget = await targetResolver.ResolveSegmentAsync(envId, segmentId);
            return segmentTarget;
        }
    }
}
