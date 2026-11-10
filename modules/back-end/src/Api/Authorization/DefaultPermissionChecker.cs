using Application.Services;
using Domain.Policies;
using Domain.Resources;

namespace Api.Authorization;

public class DefaultPermissionChecker(
    IResourceService resourceService,
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

        var resource = await GetResourceRnAsync(permission, resourceType, httpContext.Request);
        if (resource == null || string.IsNullOrWhiteSpace(resource.Rn))
        {
            // failed to get resource RN, return false to be safe. This usually indicates bad requests, e.g. invalid or missing route parameters.
            return false;
        }

        // Ensure the resolved resource's organization context matches the request organization.
        if (resourceType != ResourceTypes.Workspace && resource.OrganizationId != httpContext.Request.OrganizationId())
        {
            return false;
        }

        // check if the user has the required permission on the resource
        var statements = await requestPermissions.GetAsync(httpContext);
        return PolicyHelper.IsAllowed(statements, resource.Rn, permission);
    }

    private async ValueTask<ResourceRn?> GetResourceRnAsync(string permission, string resourceType, HttpRequest request)
    {
        var routeValues = request.RouteValues;

        return resourceType switch
        {
            ResourceTypes.Workspace => new ResourceRn(RN.ForWorkspace(), null),
            ResourceTypes.Iam => new ResourceRn(RN.ForIam(), request.OrganizationId()),
            ResourceTypes.AccessToken => new ResourceRn(RN.ForAccessToken(), request.OrganizationId()),
            ResourceTypes.Organization => new ResourceRn(RN.ForOrganization(), request.OrganizationId()),
            ResourceTypes.RelayProxy => new ResourceRn(RN.ForRelayProxy(), request.OrganizationId()),
            ResourceTypes.Project => await GetProjectRnAsync(),
            ResourceTypes.Env => await GetEnvRnAsync(),
            ResourceTypes.FeatureFlag => await GetFlagRnAsync(),
            ResourceTypes.Segment => await GetSegmentRnAsync(),
            _ => null
        };

        async Task<ResourceRn?> GetProjectRnAsync()
        {
            if (permission == Permissions.CreateProject)
            {
                // `CreateProject` is a special case as it doesn't have projectId in route values.
                // It operates on organization level, so we can return project level wildcard.
                return new ResourceRn("project/*", request.OrganizationId());
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

            var rn = await resourceService.GetProjectRnAsync(projectId);

            if (rn == null)
            {
                return null;
            }

            return permission == Permissions.CreateEnv
                // return env level wildcard for `CreateEnv` permission
                ? rn with { Rn = $"{rn.Rn}:env/*" }
                : rn;
        }

        async Task<ResourceRn?> GetEnvRnAsync()
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

            return await resourceService.GetEnvRnAsync(envId);
        }

        async Task<ResourceRn?> GetFlagRnAsync()
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
                var environment = await resourceService.GetEnvRnAsync(envId);
                return environment == null || string.IsNullOrWhiteSpace(environment.Rn)
                    ? null : environment with { Rn = $"{environment.Rn}:flag/*" };
            }

            var key = keyRouteValue?.ToString()!;

            return await resourceService.GetFlagRnAsync(envId, key);
        }

        async Task<ResourceRn?> GetSegmentRnAsync()
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
                var environment = await resourceService.GetEnvRnAsync(envId);
                return environment == null || string.IsNullOrWhiteSpace(environment.Rn)
                    ? null : environment with { Rn = $"{environment.Rn}:segment/*" };
            }

            if (!Guid.TryParse(segmentIdRouteValue?.ToString(), out var segmentId))
            {
                // invalid segment id, return empty
                logger.LogWarning("Invalid segmentId '{SegmentId}' in route values.", segmentIdRouteValue);
                return null;
            }

            var rn = await resourceService.GetSegmentRnAsync(envId, segmentId);
            return rn;
        }
    }
}
