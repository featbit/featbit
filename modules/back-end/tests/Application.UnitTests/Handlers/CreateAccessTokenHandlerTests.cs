using Application.AccessTokens;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Services;
using Application.Users;
using Domain.AccessTokens;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.Handlers;

public class CreateAccessTokenHandlerTests
{
    [Fact]
    public async Task Handle_NameAlreadyUsed_ThrowsBusinessException()
    {
        var service = new Mock<IAccessTokenService>();
        service.Setup(x => x.IsNameUsedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(true);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());
        var sut = new CreateAccessTokenHandler(service.Object, currentUser.Object);
        var request = new CreateAccessToken
        {
            OrganizationId = Guid.NewGuid(),
            Name = "duplicate",
            Type = AccessTokenTypes.Personal,
            CurrentUserPermissions =
            [
                new PolicyStatement
                {
                    Id = Guid.NewGuid().ToString(),
                    ResourceType = ResourceTypes.AccessToken,
                    Effect = EffectType.Allow,
                    Actions = [Permissions.ManagePersonalAccessTokens],
                    Resources = [RN.ForAccessToken()]
                }
            ]
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => sut.Handle(request, CancellationToken.None));

        Assert.Equal(ErrorCodes.NameHasBeenUsed, ex.Message);
        service.Verify(x => x.AddOneAsync(It.IsAny<AccessToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NewName_PersistsAndReturnsToken()
    {
        var service = new Mock<IAccessTokenService>();
        service.Setup(x => x.IsNameUsedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(false);
        var currentUserId = Guid.NewGuid();
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(currentUserId);
        var sut = new CreateAccessTokenHandler(service.Object, currentUser.Object);
        var orgId = Guid.NewGuid();
        var request = new CreateAccessToken
        {
            OrganizationId = orgId,
            Name = "tok",
            Type = AccessTokenTypes.Personal,
            CurrentUserPermissions =
            [
                new PolicyStatement
                {
                    Id = Guid.NewGuid().ToString(),
                    ResourceType = ResourceTypes.AccessToken,
                    Effect = EffectType.Allow,
                    Actions = [Permissions.ManagePersonalAccessTokens],
                    Resources = [RN.ForAccessToken()]
                }
            ]
        };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.Equal("tok", result.Name);
        Assert.Equal(orgId, result.OrganizationId);
        Assert.Equal(currentUserId, result.CreatorId);
        service.Verify(x => x.AddOneAsync(It.IsAny<AccessToken>()), Times.Once);
    }
}
