using System.Linq.Expressions;
using Application.AuditLogs;
using Application.AccessTokens;
using Application;
using Application.Bases.Exceptions;
using Application.Services;
using Application.Users;
using Domain.AccessTokens;
using Domain.Organizations;
using Domain.Workspaces;
using Microsoft.AspNetCore.Http;

namespace Application.UnitTests.Handlers;

public class AuditLogAccessTests
{
    [Theory]
    [InlineData(null)]
    [InlineData(AccessTokenTypes.Personal)]
    public async Task User_MustBelongToWorkspaceAndOrganization(string? tokenType)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var organizations = Organizations(workspaceId, orgId);
        organizations.Setup(x => x.ContainsUserAsync(orgId, userId)).ReturnsAsync(true);
        var users = new Mock<IUserService>(MockBehavior.Strict);
        users.Setup(x => x.GetWorkspacesAsync(userId)).ReturnsAsync([new Workspace { Id = workspaceId }]);
        var currentUser = Mock.Of<ICurrentUser>(x => x.Id == (tokenType == null ? userId : Guid.NewGuid()));
        var context = new DefaultHttpContext();
        var access = new AuditLogAccess(organizations.Object, users.Object, currentUser, Identity(context));
        if (tokenType != null)
            context.Items[ApplicationConsts.AccessTokenItem] = new AccessToken(orgId, userId, "test", tokenType, []);

        await access.EnsureAsync(workspaceId, orgId);
        organizations.Setup(x => x.ContainsUserAsync(orgId, userId)).ReturnsAsync(false);
        await Assert.ThrowsAsync<ForbiddenException>(() => access.EnsureAsync(workspaceId, orgId));
        organizations.Setup(x => x.ContainsUserAsync(orgId, userId)).ReturnsAsync(true);
        users.Setup(x => x.GetWorkspacesAsync(userId)).ReturnsAsync([]);
        await Assert.ThrowsAsync<ForbiddenException>(() => access.EnsureAsync(workspaceId, orgId));
    }

    [Theory]
    [InlineData(AccessTokenTypes.Service)]
    [InlineData(AccessTokenTypes.Personal)]
    public async Task Token_CannotUseAnotherOrganization(string tokenType)
    {
        var context = new DefaultHttpContext();
        context.Items[ApplicationConsts.AccessTokenItem] = new AccessToken(Guid.NewGuid(), Guid.NewGuid(), "test", tokenType, []);
        var access = new AuditLogAccess(Mock.Of<IOrganizationService>(MockBehavior.Strict),
            Mock.Of<IUserService>(MockBehavior.Strict), Mock.Of<ICurrentUser>(MockBehavior.Strict), Identity(context));
        await Assert.ThrowsAsync<ForbiddenException>(() => access.EnsureAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task ServiceToken_MustBelongToWorkspaceAndOrganization_WithoutCheckingCreatorMembership()
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var organizations = Organizations(workspaceId, orgId);
        var context = new DefaultHttpContext();
        context.Items[ApplicationConsts.AccessTokenItem] = new AccessToken(orgId, Guid.NewGuid(), "test", AccessTokenTypes.Service, []);
        var access = new AuditLogAccess(organizations.Object, Mock.Of<IUserService>(MockBehavior.Strict),
            Mock.Of<ICurrentUser>(MockBehavior.Strict), Identity(context));

        await access.EnsureAsync(workspaceId, orgId);
        await Assert.ThrowsAsync<ForbiddenException>(() => access.EnsureAsync(Guid.NewGuid(), orgId));
    }

    [Fact]
    public async Task User_CannotUseOrganizationOutsideRequestedWorkspace()
    {
        var orgId = Guid.NewGuid();
        var context = new DefaultHttpContext();
        var access = new AuditLogAccess(Organizations(Guid.NewGuid(), orgId).Object,
            Mock.Of<IUserService>(MockBehavior.Strict), Mock.Of<ICurrentUser>(MockBehavior.Strict), Identity(context));
        await Assert.ThrowsAsync<ForbiddenException>(() => access.EnsureAsync(Guid.NewGuid(), orgId));
    }

    private static ICurrentAccessToken Identity(HttpContext context) =>
        new CurrentAccessToken(new HttpContextAccessor { HttpContext = context });

    private static Mock<IOrganizationService> Organizations(Guid workspaceId, Guid orgId)
    {
        var organization = new Organization(workspaceId, "Org", "org") { Id = orgId };
        var organizations = new Mock<IOrganizationService>(MockBehavior.Strict);
        organizations.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
            .ReturnsAsync((Expression<Func<Organization, bool>> predicate) => predicate.Compile()(organization) ? organization : null);
        return organizations;
    }
}
