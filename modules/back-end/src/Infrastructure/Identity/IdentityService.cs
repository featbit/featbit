using System.Text;
using Application.Identity;
using Application.Services;
using Domain.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Options;
using IdentityOptions = Domain.Identity.IdentityOptions;

namespace Infrastructure.Identity;

public class IdentityService : IIdentityService
{
    private readonly IUserStore _store;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IdentityOptions _options;

    public IdentityService(
        IUserStore store,
        IPasswordHasher<User> passwordHasher,
        IOptions<IdentityOptions> options)
    {
        _passwordHasher = passwordHasher;
        _store = store;
        _options = options.Value;
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

        await _store.UpdateAsync(user);

        return IdentityResult.Success;
    }

    public string IssueToken(User user)
    {
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var jwt = new JwtSecurityToken(
            _options.Issuer,
            _options.Audience,
            expires: DateTime.Now.AddMonths(1),
            claims: user.Claims(),
            signingCredentials: credentials
        );

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(jwt);
    }

    public async Task<LoginResult> LoginByPasswordAsync(string identity, string password)
    {
        var user = await _store.FindByIdentityAsync(identity);
        if (user == null)
        {
            return LoginResult.Failed("identity not exist, please register first.");
        }

        var passwordMatch = await CheckPasswordAsync(user, password);
        if (!passwordMatch)
        {
            return LoginResult.Failed("identity/password not match.");
        }

        var token = IssueToken(user);
        return LoginResult.Ok(token);
    }
}