using Domain.Identity;
using Domain.Users;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Application.UnitTests.Identity;

public class IdentityServiceTests
{
    private readonly Mock<IPasswordHasher<User>> _passwordHasherMock = new();
    private readonly IdentityService _identityService;

    public IdentityServiceTests()
    {
        _identityService = new IdentityService(
            null!,
            _passwordHasherMock.Object,
            Options.Create(new JwtOptions())
        );
    }

    [Fact]
    public async Task CheckUserPassword()
    {
        const string hashedPwd = "hashed-pwd";
        const string realPwd = "pwd";

        var user = new User(Guid.NewGuid(), "identity", hashedPwd);

        _passwordHasherMock
            .Setup(x => x.VerifyHashedPassword(user, hashedPwd, realPwd))
            .Returns(PasswordVerificationResult.Success);

        var checkPassed = await _identityService.CheckPasswordAsync(user, realPwd);
        Assert.True(checkPassed);
    }
}