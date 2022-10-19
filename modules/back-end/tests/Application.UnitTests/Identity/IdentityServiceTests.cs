using System.Linq.Expressions;
using Domain.Identity;
using Domain.Users;
using Infrastructure.Identity;
using Infrastructure.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace Application.UnitTests.Identity;

public class IdentityServiceTests
{
    private readonly Mock<IUserStore> _userStoreMock = new();
    private readonly Mock<IPasswordHasher<User>> _passwordHasherMock = new();
    private readonly IdentityService _identityService;

    private readonly JwtOptions _jwtOptions = new()
    {
        Issuer = "test runner",
        Audience = "test",
        Key = "featbit-identity-key"
    };

    public IdentityServiceTests()
    {
        _identityService = new IdentityService(
            _userStoreMock.Object,
            _passwordHasherMock.Object,
            Options.Create(_jwtOptions)
        );
    }

    [Fact]
    public async Task CheckUserPassword()
    {
        const string hashedPwd = "hashed-pwd";
        const string realPwd = "pwd";

        var user = new User("identity", hashedPwd);

        _passwordHasherMock
            .Setup(x => x.VerifyHashedPassword(user, hashedPwd, realPwd))
            .Returns(PasswordVerificationResult.Success);

        var checkPassed = await _identityService.CheckPasswordAsync(user, realPwd);
        Assert.True(checkPassed);
    }

    [Fact]
    public async Task LoginInByPassword()
    {
        const string hashedPwd = "hashed-pwd";
        const string realPwd = "pwd";

        var user = new User(Guid.NewGuid(), "identity", hashedPwd);

        _passwordHasherMock
            .Setup(x => x.VerifyHashedPassword(user, hashedPwd, realPwd))
            .Returns(PasswordVerificationResult.Success);

        _userStoreMock
            .Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<User,bool>>>()))
            .Returns(Task.FromResult(user)!);

        var loginResult = await _identityService.LoginByEmailAsync(user.Email, realPwd);

        Assert.True(loginResult.Success);
        Assert.Empty(loginResult.ErrorCode);
        Assert.NotEmpty(loginResult.Token);
    }
}