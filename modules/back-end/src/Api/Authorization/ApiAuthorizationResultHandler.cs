using Api.Controllers;
using Application.Bases;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.Net.Http.Headers;

namespace Api.Authorization;

public class ApiAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _defaultHandler = new();

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        if (!authorizeResult.Succeeded)
        {
            var response = context.Response;

            response.Headers.Append(
                HeaderNames.WWWAuthenticate,
                JwtBearerDefaults.AuthenticationScheme
            );
            response.StatusCode = StatusCodes.Status401Unauthorized;

            var authError = ApiResponse<object>.Error(ErrorCodes.Unauthorized);
            await response.WriteAsJsonAsync(authError);

            return;
        }

        // fallback to the default implementation
        await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
    }
}