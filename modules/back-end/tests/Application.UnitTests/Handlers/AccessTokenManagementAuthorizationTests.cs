using Application.AccessTokens;
using Application.Bases.Exceptions;
using Application.Services;
using AutoMapper;
using Domain.AccessTokens;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.Handlers;

public class AccessTokenManagementAuthorizationTests
{
    private static PolicyStatement[] Allow(string permission) =>
    [
        new PolicyStatement
        {
            Id = Guid.NewGuid().ToString(),
            ResourceType = ResourceTypes.AccessToken,
            Effect = EffectType.Allow,
            Actions = [permission],
            Resources = ["access-token/*"]
        }
    ];

    private static AccessToken Token(Guid organizationId, string type) =>
        new(organizationId, Guid.NewGuid(), "token", type, []);

    [Fact]
    public async Task UpdatePersonal_WithOnlyServicePermission_ThrowsForbidden()
    {
        var organizationId = Guid.NewGuid();
        var token = Token(organizationId, AccessTokenTypes.Personal);
        var service = new Mock<IAccessTokenService>();
        service.Setup(x => x.GetAsync(token.Id)).ReturnsAsync(token);
        var mapper = new Mock<IMapper>();
        var sut = new UpdateAccessTokenHandler(service.Object, mapper.Object);

        var request = new UpdateAccessToken
        {
            Id = token.Id,
            OrganizationId = organizationId,
            Name = "updated",
            CurrentUserPermissions = Allow(Permissions.ManageServiceAccessTokens)
        };

        await Assert.ThrowsAsync<ForbiddenException>(() => sut.Handle(request, CancellationToken.None));

        service.Verify(x => x.FindOneAsync(It.IsAny<System.Linq.Expressions.Expression<Func<AccessToken, bool>>>()), Times.Never);
        service.Verify(x => x.UpdateAsync(It.IsAny<AccessToken>()), Times.Never);
    }

    [Fact]
    public async Task ToggleService_WithServicePermission_Succeeds()
    {
        var organizationId = Guid.NewGuid();
        var token = Token(organizationId, AccessTokenTypes.Service);
        var service = new Mock<IAccessTokenService>();
        service.Setup(x => x.GetAsync(token.Id)).ReturnsAsync(token);
        var sut = new ToggleAccessTokenStatusHandler(service.Object);

        var result = await sut.Handle(new ToggleAccessTokenStatus
        {
            Id = token.Id,
            OrganizationId = organizationId,
            CurrentUserPermissions = Allow(Permissions.ManageServiceAccessTokens)
        }, CancellationToken.None);

        Assert.True(result);
        Assert.Equal(AccessTokenStatus.Inactive, token.Status);
        service.Verify(x => x.UpdateAsync(token), Times.Once);
    }

    [Fact]
    public async Task DeleteService_WithOnlyPersonalPermission_ThrowsForbidden()
    {
        var organizationId = Guid.NewGuid();
        var token = Token(organizationId, AccessTokenTypes.Service);
        var service = new Mock<IAccessTokenService>();
        service.Setup(x => x.GetAsync(token.Id)).ReturnsAsync(token);
        var sut = new DeleteAccessTokenHandler(service.Object);

        await Assert.ThrowsAsync<ForbiddenException>(() => sut.Handle(new DeleteAccessToken
        {
            Id = token.Id,
            OrganizationId = organizationId,
            CurrentUserPermissions = Allow(Permissions.ManagePersonalAccessTokens)
        }, CancellationToken.None));

        service.Verify(x => x.DeleteOneAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task DeleteToken_FromAnotherOrganization_ThrowsForbidden()
    {
        var token = Token(Guid.NewGuid(), AccessTokenTypes.Personal);
        var service = new Mock<IAccessTokenService>();
        service.Setup(x => x.GetAsync(token.Id)).ReturnsAsync(token);
        var sut = new DeleteAccessTokenHandler(service.Object);

        await Assert.ThrowsAsync<ForbiddenException>(() => sut.Handle(new DeleteAccessToken
        {
            Id = token.Id,
            OrganizationId = Guid.NewGuid(),
            CurrentUserPermissions = Allow(Permissions.ManagePersonalAccessTokens)
        }, CancellationToken.None));

        service.Verify(x => x.DeleteOneAsync(It.IsAny<Guid>()), Times.Never);
    }
}
