using Application.Identity;
using Domain.Identity;
using Microsoft.AspNetCore.Identity;

namespace Application.Services;

public interface IIdentityService
{
    Task<bool> CheckPasswordAsync(User user, string password);

    Task<IdentityResult> ResetPasswordAsync(User user, string newPassword);

    string IssueToken(User user);

    Task<LoginResult> LoginByEmailAsync(string identity, string password);
}