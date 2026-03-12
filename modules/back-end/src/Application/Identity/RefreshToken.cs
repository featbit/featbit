using Application.Bases;

namespace Application.Identity;

public class RefreshToken : IRequest<RefreshTokenResult>
{
    public string Token { get; init; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;
}

public class RefreshTokenHandler : IRequestHandler<RefreshToken, RefreshTokenResult>
{
    private readonly IUserService _userService;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly ITokenHashService _hashService;
    private readonly IIdentityService _identityService;

    public RefreshTokenHandler(
        IUserService userService,
        IRefreshTokenService refreshTokenService,
        ITokenHashService hashService,
        IIdentityService identityService)
    {
        _userService = userService;
        _refreshTokenService = refreshTokenService;
        _hashService = hashService;
        _identityService = identityService;
    }

    public async Task<RefreshTokenResult> Handle(RefreshToken request, CancellationToken cancellationToken)
    {
        var hashedToken = _hashService.HashToken(request.Token);
        var storedToken = await _refreshTokenService.GetByTokenAsync(hashedToken);

        if (storedToken == null || !storedToken.IsActive)
        {
            return RefreshTokenResult.Failed("INVALID_REFRESH_TOKEN");
        }
        
        // Get user
        var user = await _userService.GetAsync(storedToken.UserId);

        // Generate new access token using IdentityService
        var newAccessToken = _identityService.IssueToken(user);
        
        // Generate new refresh token (token rotation)
        var newRefreshTokenPair = await _refreshTokenService.CreateAsync(storedToken.UserId, request.IpAddress);
        
        // Revoke the old refresh token
        storedToken.Revoke(request.IpAddress, newRefreshTokenPair.Item2);
        
        // Save changes
        await _refreshTokenService.UpdateAsync(storedToken);

        return RefreshTokenResult.Succeed(newAccessToken, newRefreshTokenPair.Item1);
    }
}