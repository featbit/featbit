using Api.Authentication;
using Api.Authorization;
using Api.Controllers;
using Api.Mcp;
using Application.Bases;
using Microsoft.AspNetCore.Mvc.Controllers;

namespace Api.Middlewares;

public class TenantAccessValidationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ITenantAccessValidator validator)
    {
        if (RequiresValidation(context))
        {
            var isValid = await validator.ValidateAsync(context);
            if (!isValid)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(ApiResponse<object>.Error(ErrorCodes.Forbidden));

                return;
            }
        }

        await next(context);
    }

    private static bool RequiresValidation(HttpContext context)
    {
        // No endpoint was matched; let the remaining pipeline handle the request.
        var endpoint = context.GetEndpoint();
        if (endpoint == null)
        {
            return false;
        }

        // Unauthenticated requests and identities authenticated with a non-JWT scheme.
        if (context.User.Identity is not { IsAuthenticated: true, AuthenticationType: Schemes.JwtBearer })
        {
            return false;
        }

        // Endpoints that explicitly allow anonymous access.
        if (endpoint.Metadata.GetMetadata<IAllowAnonymous>() != null)
        {
            return false;
        }

        // MCP requests are exempt from tenant context validation.
        if (IsMcpRequest())
        {
            return false;
        }

        return true;

        bool IsMcpRequest()
        {
            // MCP protocol endpoints under /mcp are not MVC controller actions.
            if (context.Request.Path.StartsWithSegments("/mcp"))
            {
                return true;
            }

            // Identify MCP access tokens by their token-type claim.
            if (context.User.FindFirst(McpClaimTypes.TokenType)?.Value == McpClaimTypes.McpTokenType)
            {
                return true;
            }

            // MCP OAuth endpoints also bypass tenant validation when using an ordinary user JWT.
            var action = endpoint.Metadata.GetMetadata<ControllerActionDescriptor>();
            if (action?.ControllerTypeInfo.AsType() == typeof(McpOAuthController))
            {
                return true;
            }

            return false;
        }
    }
}
