#nullable enable

using Domain.AccessTokens;
using Microsoft.AspNetCore.Http;

namespace Application.AccessTokens;

public class CurrentAccessToken(IHttpContextAccessor httpContextAccessor) : ICurrentAccessToken
{
    public AccessToken? Token =>
        httpContextAccessor.HttpContext?.Items[ApplicationConsts.AccessTokenItem] as AccessToken;
}
