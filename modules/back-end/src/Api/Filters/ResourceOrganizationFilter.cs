using Api.Authorization;
using Api.Controllers;
using Application.FeatureFlags;
using Application.Services;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

// RN keys are scoped within an organization and cannot establish ownership by themselves.
public class ResourceOrganizationFilter(IResourceService resources, IRequestPermissions permissions) : IAsyncActionFilter
{
    public virtual async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;
        var route = request.RouteValues;
        var controller = (context.ActionDescriptor as ControllerActionDescriptor)?.ControllerTypeInfo.AsType();
        var projectId = ReadId("projectId") ?? (controller == typeof(ProjectController) ? ReadId("id") : null);
        var envId = ReadId("envId") ?? (controller == typeof(EnvironmentController) ? ReadId("id") : null);
        var envIds = new[] { envId, ReadId("targetEnvId"), ReadId("sourceEnvId") }
            .OfType<Guid>()
            .Concat(context.ActionArguments.Values.OfType<GetCompareFlagOverview>()
                .SelectMany(x => x.TargetEnvIds ?? []))
            .Distinct().ToArray();
        var organizationId = request.OrganizationId();
        if (organizationId == Guid.Empty)
        {
            if (projectId.HasValue || envIds.Length > 0)
                context.Result = new ForbidResult();
            else
                await next();
            return;
        }

        var workspaceId = await resources.GetOrganizationWorkspaceIdAsync(organizationId);
        if (workspaceId == null || (request.WorkspaceId() != Guid.Empty && request.WorkspaceId() != workspaceId))
        {
            context.Result = new ForbidResult();
            return;
        }
        request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceId.Value.ToString();

        if (projectId.HasValue || envIds.Length > 0)
        {
            if ((await permissions.GetAsync(context.HttpContext)).Length == 0 ||
                (projectId.HasValue && !await resources.IsProjectInOrganizationAsync(organizationId, projectId.Value)))
            {
                context.Result = new ForbidResult();
                return;
            }
            foreach (var id in envIds)
            {
                if (!await resources.IsEnvInOrganizationAsync(organizationId, id, projectId))
                {
                    context.Result = new ForbidResult();
                    return;
                }
            }
        }

        if (envId.HasValue && controller == typeof(SegmentController))
        {
            var ids = context.ActionArguments.TryGetValue("ids", out var values) && values is Guid[] requestedIds
                ? requestedIds
                : ReadId("segmentId") is { } segmentId ? [segmentId] : Array.Empty<Guid>();
            foreach (var id in ids.Distinct())
            {
                if (string.IsNullOrWhiteSpace(await resources.GetSegmentRnAsync(envId.Value, id)))
                {
                    context.Result = new ForbidResult();
                    return;
                }
            }
        }

        await next();
        return;

        Guid? ReadId(string name) => route.TryGetValue(name, out var value) && Guid.TryParse(value?.ToString(), out var id)
            ? id : null;
    }
}
