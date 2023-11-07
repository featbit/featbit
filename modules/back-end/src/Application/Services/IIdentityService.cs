using Application.Identity;
using Domain.Users;
using Microsoft.AspNetCore.Identity;

namespace Application.Services;

public interface IIdentityService
{
    Task<bool> CheckPasswordAsync(User user, string password);

    Task<IdentityResult> ResetPasswordAsync(User user, string newPassword);

    string IssueToken(User user);

    Task<LoginResult> LoginByEmailAsync(string email, string password, Guid accountId);

    Task<RegisterResult> RegisterByEmailAsync(Guid accountId, string email, string password, string origin);
}