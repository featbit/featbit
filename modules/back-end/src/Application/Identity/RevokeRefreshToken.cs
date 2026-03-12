using Domain.RefreshTokens;

namespace Application.Identity;

public class RevokeRefreshToken : IRequest<bool>
{
    public string Token { get; set; }

    public string IpAddress { get; set; }
}

public class RevokeRefreshTokenHandler(IRefreshTokenService refreshTokenService)
    : IRequestHandler<RevokeRefreshToken, bool>
{
    public async Task<bool> Handle(RevokeRefreshToken request, CancellationToken cancellationToken)
    {
        var hashedToken = RefreshToken.HashToken(request.Token);

        var storedToken = await refreshTokenService.FindOneAsync(x => x.Token == hashedToken);
        if (storedToken is not { IsActive: true })
        {
            return false;
        }

        storedToken.Revoke(request.IpAddress, null);
        await refreshTokenService.UpdateAsync(storedToken);

        return true;
    }
}