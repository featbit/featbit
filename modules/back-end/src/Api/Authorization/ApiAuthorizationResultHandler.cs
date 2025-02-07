using Api.Controllers;
using Application.Bases;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.Net.Http.Headers;

namespace Api.Authorization;

public sealed class ApiAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    private static readonly ApiResponse<object> UnauthorizedResponse = ApiResponse<object>.Error(ErrorCodes.Unauthorized);
    private static readonly ApiResponse<object> ForbiddenResponse = ApiResponse<object>.Error(ErrorCodes.Forbidden);

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (authorizeResult.Challenged)
        {
            context.Response.Headers[HeaderNames.WWWAuthenticate] = JwtBearerDefaults.AuthenticationScheme;
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(UnauthorizedResponse);
            return;
        }

        if (authorizeResult.Forbidden)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(ForbiddenResponse);
            return;
        }

        await next(context);
    }
}   