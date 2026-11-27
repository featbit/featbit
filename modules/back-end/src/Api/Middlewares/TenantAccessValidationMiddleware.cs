using Api.Authentication;
using Api.Authorization;
using Api.Controllers;
using Application.Bases;

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

        return true;
    }
}
