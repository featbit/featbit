#nullable enable

using Domain.AccessTokens;

namespace Application.AccessTokens;

public interface ICurrentAccessToken
{
    AccessToken? Token { get; }
}
