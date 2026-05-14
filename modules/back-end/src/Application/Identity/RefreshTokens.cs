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

        var existingToken = await refreshTokenService.FindOneAsync(x => x.Token == hashedToken);
        if (existingToken is not { IsActive: true })
        {
            return RefreshTokensResult.Failed(ErrorCodes.Invalid(nameof(RefreshTokens)));
        }

        // generate new oauth tokens
        var user = await userService.GetAsync(existingToken.UserId);
        var authTokens = await identityService.IssueTokensAsync(user, request.IpAddress);

        // revoke the existing refresh token
        existingToken.Revoke(request.IpAddress, authTokens.RefreshToken);
        await refreshTokenService.UpdateAsync(existingToken);

        return RefreshTokensResult.Succeed(authTokens);
    }
}