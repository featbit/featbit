using System.Security.Claims;
using Application.Bases;
using Application.Identity;
using Domain.RefreshTokens;
using Domain.Users;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Services;

public class IdentityService : IIdentityService
{
    private readonly IUserService _userService;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly JwtOptions _options;

    public IdentityService(
        IUserService userService,
        IPasswordHasher<User> passwordHasher,
        IRefreshTokenService refreshTokenService,
        JwtOptions options)
    {
        _userService = userService;
        _passwordHasher = passwordHasher;
        _refreshTokenService = refreshTokenService;
        _options = options;
    }

    public async Task<bool> CheckPasswordAsync(User user, string password)
    {
        var result = _passwordHasher.VerifyHashedPassword(user, user.Password, password);
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            await ResetPasswordAsync(user, password);
        }

        var isValid = result != PasswordVerificationResult.Failed;
        return isValid;
    }

    public async Task<IdentityResult> ResetPasswordAsync(User user, string newPassword)
    {
        var newPasswordHash = _passwordHasher.HashPassword(user, newPassword);
        user.Password = newPasswordHash;

        await _userService.UpdateAsync(user);

        return IdentityResult.Success;
    }

    public async Task<AuthTokens> IssueTokensAsync(User user, string ipAddress)
    {
        var accessToken = IssueAccessToken();
        var refreshToken = await IssueRefreshTokenAsync();

        return new AuthTokens(accessToken, refreshToken);

        string IssueAccessToken()
        {
            var credentials = new SigningCredentials(_options.SigningSecurityKey, _options.Algorithm);

            var descriptor = new SecurityTokenDescriptor
            {
                Issuer = _options.Issuer,
                Audience = _options.Audience,
                Expires = DateTime.UtcNow.AddMinutes(5),
                Subject = new ClaimsIdentity(user.Claims()),
                SigningCredentials = credentials
            };

            var handler = new JsonWebTokenHandler();
            return handler.CreateToken(descriptor);
        }

        async Task<string> IssueRefreshTokenAsync()
        {
            var rawToken = Guid.NewGuid().ToString("N");

            var record = RefreshToken.NewRecord(rawToken, user.Id, RefreshTokenConsts.ExpiryDays, ipAddress);
            await _refreshTokenService.AddOneAsync(record);

            return rawToken;
        }
    }

    public async Task<LoginResult> LoginByEmailAsync(Guid? workspaceId, string email, string password, string ipAddress)
    {
        if (workspaceId is null)
        {
            return LoginResult.Failed(ErrorCodes.EmailPasswordMismatch);
        }

        var user = await _userService.FindOneAsync(x => x.Email == email && x.WorkspaceId == workspaceId);
        if (user == null)
        {
            return LoginResult.Failed(ErrorCodes.EmailPasswordMismatch);
        }

        var passwordMatch = await CheckPasswordAsync(user, password);
        if (!passwordMatch)
        {
            return LoginResult.Failed(ErrorCodes.EmailPasswordMismatch);
        }

        var tokens = await IssueTokensAsync(user, ipAddress);
        return LoginResult.Ok(tokens);
    }

    public async Task<RegisterResult> RegisterByEmailAsync(Guid workspaceId, string email, string password, string origin)
    {
        var hashedPwd = string.IsNullOrWhiteSpace(password)
            ? string.Empty
            : _passwordHasher.HashPassword(null!, password);

        var user = new User(workspaceId, email, hashedPwd, origin: origin);

        await _userService.AddOneAsync(user);

        return RegisterResult.Ok(user);
    }
}