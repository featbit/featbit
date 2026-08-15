using System.Security.Claims;
using Api.Authentication;
using Application;
using Application.Users;
using Domain.AccessTokens;
using Microsoft.AspNetCore.Http;

namespace Api.UnitTests.Authentication;

public class ProjectCreatorResolverTests
{
    [Fact]
    public void Resolve_JwtRequest_ReturnsCurrentUserId()
    {
        var userId = Guid.NewGuid();
        var context = BuildContext(Schemes.JwtBearer);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.Setup(x => x.Id).Returns(userId);

        var creatorId = ProjectCreatorResolver.Resolve(context, currentUser.Object);

        Assert.Equal(userId, creatorId);
    }

    [Fact]
    public void Resolve_PersonalAccessTokenRequest_ReturnsTokenCreatorId()
    {
        var creatorId = Guid.NewGuid();
        var token = BuildAccessToken(AccessTokenTypes.Personal, creatorId);
        var context = BuildContext(Schemes.OpenApi);
        context.Items[ApplicationConsts.AccessTokenItem] = token;
        var currentUser = new Mock<ICurrentUser>(MockBehavior.Strict);

        var resolvedCreatorId = ProjectCreatorResolver.Resolve(context, currentUser.Object);

        Assert.Equal(creatorId, resolvedCreatorId);
        Assert.NotEqual(token.Id, resolvedCreatorId);
    }

    [Fact]
    public void Resolve_ServiceAccessTokenRequest_ReturnsEmptyId()
    {
        var token = BuildAccessToken(AccessTokenTypes.Service, Guid.NewGuid());
        var context = BuildContext(Schemes.OpenApi);
        context.Items[ApplicationConsts.AccessTokenItem] = token;
        var currentUser = new Mock<ICurrentUser>(MockBehavior.Strict);

        var creatorId = ProjectCreatorResolver.Resolve(context, currentUser.Object);

        Assert.Equal(Guid.Empty, creatorId);
    }

    [Fact]
    public void Resolve_OpenApiRequestWithoutStoredToken_ReturnsEmptyId()
    {
        var context = BuildContext(Schemes.OpenApi);
        var currentUser = new Mock<ICurrentUser>(MockBehavior.Strict);

        var creatorId = ProjectCreatorResolver.Resolve(context, currentUser.Object);

        Assert.Equal(Guid.Empty, creatorId);
    }

    private static DefaultHttpContext BuildContext(string authenticationType)
    {
        return new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([], authenticationType))
        };
    }

    private static AccessToken BuildAccessToken(string type, Guid creatorId)
    {
        return new AccessToken(Guid.NewGuid(), creatorId, "token", type, [])
        {
            Id = Guid.NewGuid()
        };
    }
}
