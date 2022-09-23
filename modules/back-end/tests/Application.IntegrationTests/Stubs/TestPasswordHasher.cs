using Domain.Users;
using Microsoft.AspNetCore.Identity;

namespace Application.IntegrationTests.Stubs;

public class TestPasswordHasher : IPasswordHasher<User>
{
    public string HashPassword(User user, string password)
    {
        return $"hashed-{password}";
    }

    public PasswordVerificationResult VerifyHashedPassword(User user, string hashedPassword, string providedPassword)
    {
        return hashedPassword == $"hashed-{providedPassword}"
            ? PasswordVerificationResult.Success
            : PasswordVerificationResult.Failed;
    }
}