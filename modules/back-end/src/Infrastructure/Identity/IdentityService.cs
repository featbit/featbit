using System.Text;
using Application.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Application.Bases;
using Domain.Identity;
using Domain.Users;
using Microsoft.Extensions.Options;

namespace Infrastructure.Identity;

public class IdentityService : IIdentityService
{
    private readonly IUserService _userService;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly JwtOptions _options;

    public IdentityService(
        IUserService userService,
        IPasswordHasher<User> passwordHasher,
        IOptions<JwtOptions> options)
    {
        _userService = userService;
        _passwordHasher = passwordHasher;
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

        await _userService.UpdateAsync(user);

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

    public async Task<LoginResult> LoginByEmailAsync(Guid? workspaceId, string email, string password)
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

        var token = IssueToken(user);
        return LoginResult.Ok(token);
    }

    public async Task<RegisterResult> RegisterByEmailAsync(Guid workspaceId, string email, string password, string origin)
    {
        var hashedPwd = string.IsNullOrWhiteSpace(password)
            ? string.Empty
            : _passwordHasher.HashPassword(null!, password);

        var user = new User(workspaceId, email, hashedPwd, origin: origin);

        await _userService.AddOneAsync(user);

        var token = IssueToken(user);
        return RegisterResult.Ok(user.Id, token);
    }
}