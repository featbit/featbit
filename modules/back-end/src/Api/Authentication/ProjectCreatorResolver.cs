using Application;
using Application.Users;
using Domain.AccessTokens;

namespace Api.Authentication;

internal static class ProjectCreatorResolver
{
    internal static Guid Resolve(HttpContext context, ICurrentUser currentUser)
    {
        var authenticationType = context.User.Identity?.AuthenticationType;

        if (authenticationType == Schemes.JwtBearer)
        {
            return currentUser.Id;
        }

        if (authenticationType == Schemes.OpenApi &&
            context.Items[ApplicationConsts.AccessTokenItem] is AccessToken accessToken &&
            accessToken.Type == AccessTokenTypes.Personal)
        {
            return accessToken.CreatorId;
        }

        return Guid.Empty;
    }
}
