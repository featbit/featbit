namespace Application.Identity;

public class RevokeRefreshToken : IRequest<bool>
{
    public string Token { get; set; }
    public string? IpAddress { get; set; }
}

public class RevokeRefreshTokenHandler : IRequestHandler<RevokeRefreshToken, bool>
{
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly ITokenHashService _hashService;

    public RevokeRefreshTokenHandler(
        IRefreshTokenService refreshTokenService,
        ITokenHashService hashService)
    {
        _refreshTokenService = refreshTokenService;
        _hashService = hashService;
    }

    public async Task<bool> Handle(RevokeRefreshToken request, CancellationToken cancellationToken)
    {
        var hashedToken = _hashService.HashToken(request.Token);
        var storedToken = await _refreshTokenService.GetByTokenAsync(hashedToken);

        if (storedToken == null || !storedToken.IsActive)
        {
            return false;
        }

        storedToken.Revoke(request.IpAddress);
        await _refreshTokenService.UpdateAsync(storedToken);

        return true;
    }
}