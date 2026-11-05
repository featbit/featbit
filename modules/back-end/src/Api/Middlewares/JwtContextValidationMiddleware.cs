using Api.Authentication;
using Api.Authorization;
using Api.Controllers;
using Api.Mcp;
using Application.Services;
using Domain.Users;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace Api.Middlewares;

public class JwtContextValidationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IUserService users, IOrganizationService organizations)
    {
        var action = context.GetEndpoint()?.Metadata.GetMetadata<ControllerActionDescriptor>();
        // Unauthenticated requests and identities authenticated with a non-JWT scheme.
        if (context.User.Identity is not { IsAuthenticated: true, AuthenticationType: Schemes.JwtBearer } ||
            // Endpoints that explicitly allow anonymous access.
            context.GetEndpoint()?.Metadata.GetMetadata<IAllowAnonymous>() != null ||
            // MCP OAuth endpoints, including requests authenticated with an ordinary user JWT.
            action?.ControllerTypeInfo.AsType() == typeof(McpOAuthController) ||
            // Actions that explicitly skip tenant context validation.
            context.GetEndpoint()?.Metadata.GetMetadata<SkipJwtContextValidationAttribute>() != null ||
            // TODO: Handle tenant context validation for JoinOrganizationAsync in a follow-up; skip it for now.
            (action?.ControllerTypeInfo.AsType() == typeof(UserController) &&
             action.MethodInfo.Name == nameof(UserController.JoinOrganizationAsync)) ||
            // MCP protocol endpoints under /mcp, which are not MVC controller actions.
            context.Request.Path.StartsWithSegments("/mcp") ||
            // Requests carrying an MCP access token, identified by its token-type claim.
            context.User.FindFirst(McpClaimTypes.TokenType)?.Value == McpClaimTypes.McpTokenType)
        {
            await next(context);
            return;
        }

        if (!await IsValidAsync(context, users, organizations))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        await next(context);
    }

    private static async Task<bool> IsValidAsync(
        HttpContext context, IUserService users, IOrganizationService organizations)
    {
        var workspaceHeader = context.Request.Headers[ApiConstants.WorkspaceHeaderKey];
        var organizationHeader = context.Request.Headers[ApiConstants.OrgIdHeaderKey];
        var workspaceValue = workspaceHeader.ToString();
        var organizationValue = organizationHeader.ToString();
        if (!Guid.TryParse(context.User.FindFirst(UserClaims.Id)?.Value, out var userId) ||
            userId == Guid.Empty ||
            !Guid.TryParse(workspaceValue, out var workspaceId) || workspaceId == Guid.Empty ||
            !Guid.TryParse(organizationValue, out var organizationId) || organizationId == Guid.Empty)
        {
            return false;
        }

        var workspaces = await users.GetWorkspacesAsync(userId);
        if (!workspaces.Any(workspace => workspace.Id == workspaceId))
        {
            return false;
        }

        if (!await organizations.AnyAsync(org => org.Id == organizationId && org.WorkspaceId == workspaceId))
        {
            return false;
        }

        return await organizations.ContainsUserAsync(organizationId, userId);
    }
}
