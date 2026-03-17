using Api.Authentication;
using Application;
using Application.Services;
using Domain.AccessTokens;
using Domain.Policies;
using Domain.Users;

namespace Api.Authorization;

public class RequestPermissions(IMemberService memberService, ILogger<RequestPermissions> logger) : IRequestPermissions
{
    // this class is intended to be registered as a scoped service
    // so it's safe to cache permissions in a private field for the duration of the request
    private PolicyStatement[]? _permissions;

    public async Task<PolicyStatement[]> GetAsync(HttpContext context)
    {
        if (_permissions == null)
        {
            _permissions = await GetPermissionsAsync();
        }

        return _permissions;

        async Task<PolicyStatement[]> GetPermissionsAsync()
        {
            var authenticationType = context.User.Identity?.AuthenticationType;

            var statements = authenticationType switch
            {
                Schemes.JwtBearer => await GetUserPermissionsAsync(),
                Schemes.OpenApi => await GetAccessTokenPermissionsAsync(),
                _ => []
            };

            return statements;

            async Task<PolicyStatement[]> GetUserPermissionsAsync()
            {
                var userIdClaim = context.User.Claims.FirstOrDefault(x => x.Type == UserClaims.Id);
                if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
                {
                    logger.LogWarning("Malformed user id claim in JWT token.");
                    return [];
                }

                var organizationId = context.Request.OrganizationId();
                if (organizationId == Guid.Empty)
                {
                    logger.LogWarning("Malformed or missing organization id in request headers.");
                    return [];
                }

                return await memberService.GetPermissionsAsync(organizationId, userId);
            }

            async Task<PolicyStatement[]> GetAccessTokenPermissionsAsync()
            {
                if (context.Items[ApplicationConsts.AccessTokenItem] is not AccessToken accessToken)
                {
                    logger.LogWarning("Access token not found in HttpContext.Items.");
                    return [];
                }

                return accessToken.Type == AccessTokenTypes.Service
                    ? accessToken.Permissions
                    : await memberService.GetPermissionsAsync(accessToken.OrganizationId, accessToken.CreatorId);
            }
        }
    }
}