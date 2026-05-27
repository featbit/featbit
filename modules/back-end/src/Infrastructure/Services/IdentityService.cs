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

public class IdentityService(
    IUserService userService, 
    IPasswordHasher<User> passwordHasher, 
    IRefreshTokenService refreshTokenService, 
    JwtOptions options) : IIdentityService
{
    public async Task<bool> CheckPasswordAsync(User user, string password)
    {
        var result = passwordHasher.VerifyHashedPassword(user, user.Password, password);
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            await ResetPasswordAsync(user, password);
        }

        var isValid = result != PasswordVerificationResult.Failed;
        return isValid;
    }

    public async Task<IdentityResult> ResetPasswordAsync(User user, string newPassword)
    {
        var newPasswordHash = passwordHasher.HashPassword(user, newPassword);
        user.UpdatePassword(newPasswordHash);

        await userService.UpdateAsync(user);

        return IdentityResult.Success;
    }

    public async Task<AuthTokens> IssueTokensAsync(User user, string ipAddress)
    {
        var accessToken = IssueAccessToken();
        var refreshToken = await IssueRefreshTokenAsync();

        return new AuthTokens(accessToken, refreshToken);

        string IssueAccessToken()
        {
            var credentials = new SigningCredentials(options.SigningSecurityKey, options.Algorithm);

            var descriptor = new SecurityTokenDescriptor
            {
                Issuer = options.Issuer,
                Audience = options.Audience,
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
            await refreshTokenService.AddOneAsync(record);

            return rawToken;
        }
    }

    public async Task<LoginResult> LoginByEmailAsync(string email, string password, string ipAddress)
    {
        var user = await userService.FindOneAsync(x => x.Email == email);
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

    public async Task<RegisterResult> RegisterByEmailAsync(string email, string password, string origin, bool storePassword = false)
    {
        var hashedPwd = string.IsNullOrWhiteSpace(password)
            ? string.Empty
            : passwordHasher.HashPassword(null!, password);

        var user = new User(email, hashedPwd, origin: origin);
        if (storePassword)
        {
            user.InitialPassword = password;
        }

        await userService.AddOneAsync(user);

        return RegisterResult.Ok(user);
    }
}