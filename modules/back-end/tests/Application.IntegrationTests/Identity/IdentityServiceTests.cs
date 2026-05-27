using Application.Services;
using Domain.Users;
using Infrastructure.Identity;
using Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Moq;

namespace Application.IntegrationTests.Identity;

public class IdentityServiceTests
{
    private readonly Mock<IPasswordHasher<User>> _passwordHasherMock = new();
    private readonly Mock<IRefreshTokenService> _refreshTokenServiceMock = new();
    private readonly IdentityService _identityService;

    public IdentityServiceTests()
    {
        _identityService = new IdentityService(
            null!,
            _passwordHasherMock.Object,
            _refreshTokenServiceMock.Object,
            new JwtOptions()
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