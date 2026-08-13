using Application.Bases;
using Application.Identity;
using Application.Services;
using Application.Users;
using Domain.Users;

namespace Application.UnitTests.Handlers;

public class ResetPasswordHandlerTests
{
    private static (Mock<IUserService>, Mock<IIdentityService>, Mock<ICurrentUser>, User) Setup(string origin)
    {
        var userId = Guid.NewGuid();
        var user = new User(userId, "u@e.co", "pwd", origin: origin);
        var userService = new Mock<IUserService>();
        userService.Setup(x => x.GetAsync(userId)).ReturnsAsync(user);
        var identity = new Mock<IIdentityService>();
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(userId);
        return (userService, identity, currentUser, user);
    }

    [Fact]
    public async Task Handle_ExternalUser_ReturnsExternalUserCannotChangePasswordFailure()
    {
        var (userService, identity, currentUser, _) = Setup(UserOrigin.Sso);
        var sut = new ResetPasswordHandler(userService.Object, identity.Object, currentUser.Object);

        var result = await sut.Handle(new ResetPassword { CurrentPassword = "x", NewPassword = "yyyyyy" }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.ExternalUserCannotChangePassword, result.Reason);
        identity.Verify(x => x.ResetPasswordAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Handle_PasswordMismatch_ReturnsEmailPasswordMismatchFailure()
    {
        var (userService, identity, currentUser, user) = Setup(UserOrigin.Local);
        identity.Setup(x => x.CheckPasswordAsync(user, "x")).ReturnsAsync(false);
        var sut = new ResetPasswordHandler(userService.Object, identity.Object, currentUser.Object);

        var result = await sut.Handle(new ResetPassword { CurrentPassword = "x", NewPassword = "yyyyyy" }, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(ErrorCodes.EmailPasswordMismatch, result.Reason);
        identity.Verify(x => x.ResetPasswordAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Handle_PasswordMatches_CallsResetPasswordAndReturnsOk()
    {
        var (userService, identity, currentUser, user) = Setup(UserOrigin.Local);
        identity.Setup(x => x.CheckPasswordAsync(user, "current")).ReturnsAsync(true);
        var sut = new ResetPasswordHandler(userService.Object, identity.Object, currentUser.Object);

        var result = await sut.Handle(new ResetPassword { CurrentPassword = "current", NewPassword = "newpass" }, CancellationToken.None);

        Assert.True(result.Success);
        identity.Verify(x => x.ResetPasswordAsync(user, "newpass"), Times.Once);
    }
}
