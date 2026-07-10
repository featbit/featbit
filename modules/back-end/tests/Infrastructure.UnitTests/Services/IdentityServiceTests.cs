using Application.Services;
using Domain.Users;
using Infrastructure.Identity;
using Infrastructure.Services;
using Microsoft.AspNetCore.Identity;
using Moq;

namespace Infrastructure.UnitTests.Services;

public class IdentityServiceTests
{
    [Fact]
    public async Task CheckPasswordAsync_PasswordMatches_ReturnsTrue()
    {
        var user = new User(Guid.NewGuid(), "identity", "hashed-pwd");

        var hasher = new Mock<IPasswordHasher<User>>();
        hasher
            .Setup(x => x.VerifyHashedPassword(user, "hashed-pwd", "pwd"))
            .Returns(PasswordVerificationResult.Success);

        var sut = CreateSut(hasher: hasher);

        var result = await sut.CheckPasswordAsync(user, "pwd");

        Assert.True(result);
    }

    [Fact]
    public async Task CheckPasswordAsync_PasswordDoesNotMatch_ReturnsFalse()
    {
        var user = new User(Guid.NewGuid(), "identity", "hashed-pwd");

        var hasher = new Mock<IPasswordHasher<User>>();
        hasher
            .Setup(x => x.VerifyHashedPassword(user, "hashed-pwd", "wrong"))
            .Returns(PasswordVerificationResult.Failed);

        var sut = CreateSut(hasher: hasher);

        var result = await sut.CheckPasswordAsync(user, "wrong");

        Assert.False(result);
    }

    [Fact]
    public async Task CheckPasswordAsync_RehashNeeded_RehashesAndPersistsUser()
    {
        var user = new User(Guid.NewGuid(), "identity", "old-hash");

        var hasher = new Mock<IPasswordHasher<User>>();
        hasher
            .Setup(x => x.VerifyHashedPassword(user, "old-hash", "pwd"))
            .Returns(PasswordVerificationResult.SuccessRehashNeeded);
        hasher
            .Setup(x => x.HashPassword(user, "pwd"))
            .Returns("new-hash");

        var userService = new Mock<IUserService>();

        var sut = CreateSut(hasher: hasher, userService: userService);

        var result = await sut.CheckPasswordAsync(user, "pwd");

        Assert.True(result);
        Assert.Equal("new-hash", user.Password);
        userService.Verify(x => x.UpdateAsync(user), Times.Once);
    }

    private static IdentityService CreateSut(
        Mock<IUserService>? userService = null,
        Mock<IPasswordHasher<User>>? hasher = null,
        Mock<IRefreshTokenService>? refreshTokens = null,
        JwtOptions? jwt = null) =>
        new(
            (userService ?? new Mock<IUserService>()).Object,
            (hasher ?? new Mock<IPasswordHasher<User>>()).Object,
            (refreshTokens ?? new Mock<IRefreshTokenService>()).Object,
            jwt ?? new JwtOptions());
}
