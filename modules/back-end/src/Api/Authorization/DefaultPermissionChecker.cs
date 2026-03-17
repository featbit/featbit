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

        var resourceRN = await GetRnAsync(permission, resourceType, httpContext.Request);
        if (string.IsNullOrWhiteSpace(resourceRN))
        {
            // failed to get resource RN, return false to be safe. This usually indicates bad requests, e.g. invalid or missing route parameters.
            return false;
        }

        var statements = await requestPermissions.GetAsync(httpContext);
        return PolicyHelper.IsAllowed(statements, resourceRN, permission);
    }

    private async ValueTask<string?> GetRnAsync(string permission, string resourceType, HttpRequest request)
    {
        if (resourceType == ResourceTypes.Workspace)
        {
            return "workspace/*";
        }

        if (resourceType == ResourceTypes.Iam)
        {
            return "iam/*";
        }

        var routeValues = request.RouteValues;

        return resourceType switch
        {
            ResourceTypes.Project => await GetProjectRnAsync(),
            ResourceTypes.Env => await GetEnvRnAsync(),
            ResourceTypes.FeatureFlag => await GetFlagRnAsync(),
            ResourceTypes.Segment => await GetSegmentRnAsync(),
            _ => string.Empty
        };

        async Task<string?> GetProjectRnAsync()
        {
            if (permission == Permissions.CreateProject)
            {
                // `CreateProject` is a special case as it doesn't have projectId in route values.
                // It operates on organization level, so we can return project level wildcard.
                return "project/*";
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
                return string.Empty;
            }

            var rn = await resourceService.GetProjectRnAsync(projectId);
            return permission == Permissions.CreateEnv
                // return env level wildcard for `CreateEnv` permission
                ? rn == null ? null : $"{rn}:env/*"
                : rn;
        }

        async Task<string?> GetEnvRnAsync()
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
                return string.Empty;
            }

            var rn = await resourceService.GetEnvRnAsync(envId);
            return rn;
        }

        async Task<string?> GetFlagRnAsync()
        {
            if (!routeValues.TryGetValue("envId", out var envIdRouteValue) ||
                !Guid.TryParse(envIdRouteValue?.ToString(), out var envId))
            {
                // invalid or missing env id, return empty
                return string.Empty;
            }

            if (!routeValues.TryGetValue("key", out var keyRouteValue))
            {
                // missing key, return env level wildcard
                var envRn = await resourceService.GetEnvRnAsync(envId);
                return envRn == null ? null : $"{envRn}:flag/*";
            }

            var key = keyRouteValue?.ToString()!;

            var rn = await resourceService.GetFlagRnAsync(envId, key);
            return rn;
        }

        async Task<string?> GetSegmentRnAsync()
        {
            if (!routeValues.TryGetValue("envId", out var envIdRouteValue) ||
                !Guid.TryParse(envIdRouteValue?.ToString(), out var envId))
            {
                // invalid or missing env id, return empty
                return string.Empty;
            }

            // segment has no fine-grained access control for now, return env level wildcard
            var envRN = await resourceService.GetEnvRnAsync(envId);
            return envRN == null ? null : $"{envRN}:segment/*";
        }
    }
}