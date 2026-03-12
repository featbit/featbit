using Application.Bases;
using Domain.RefreshTokens;

namespace Application.Identity;

public class RefreshTokens : IRequest<RefreshTokensResult>
{
    public string Token { get; init; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;
}

public class RefreshTokensHandler(
    IUserService userService,
    IRefreshTokenService refreshTokenService,
    IIdentityService identityService)
    : IRequestHandler<RefreshTokens, RefreshTokensResult>
{
    public async Task<RefreshTokensResult> Handle(RefreshTokens request, CancellationToken cancellationToken)
    {
        var hashedToken = RefreshToken.HashToken(request.Token);

        var storedToken = await refreshTokenService.FindOneAsync(x => x.Token == hashedToken);
        if (storedToken is not { IsActive: true })
        {
            return RefreshTokensResult.Failed(ErrorCodes.Invalid(nameof(RefreshTokens)));
        }

        // generate new oauth tokens
        var user = await userService.GetAsync(storedToken.UserId);
        var authTokens = await identityService.IssueTokensAsync(user, request.IpAddress);

        // revoke the old refresh token
        storedToken.Revoke(request.IpAddress, authTokens.RefreshToken);
        await refreshTokenService.UpdateAsync(storedToken);

        return RefreshTokensResult.Succeed(authTokens);
    }
}