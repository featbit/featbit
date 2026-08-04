using Application.Bases.Exceptions;
using Domain.AccessTokens;
using Domain.Policies;
using Domain.Resources;

namespace Application.AccessTokens;

internal static class AccessTokenAuthorization
{
    public static void EnsureCanManage(PolicyStatement[] currentUserPermissions, string accessTokenType)
    {
        var permission = accessTokenType switch
        {
            AccessTokenTypes.Personal => Permissions.ManagePersonalAccessTokens,
            AccessTokenTypes.Service => Permissions.ManageServiceAccessTokens,
            _ => string.Empty
        };

        if (string.IsNullOrEmpty(permission) ||
            !PolicyHelper.IsAllowed(currentUserPermissions, RN.ForAccessToken(), permission))
        {
            throw new ForbiddenException();
        }
    }

    public static void EnsureOrganization(AccessToken accessToken, Guid organizationId)
    {
        if (accessToken.OrganizationId != organizationId)
        {
            throw new ForbiddenException();
        }
    }
}
