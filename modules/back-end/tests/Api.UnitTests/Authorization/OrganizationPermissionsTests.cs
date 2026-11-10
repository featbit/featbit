using System.Linq.Expressions;
using System.Security.Claims;
using Api.Authentication;
using Api.Authorization;
using Application.Services;
using Domain.Organizations;
using Domain.Policies;
using Domain.Users;
using Microsoft.AspNetCore.Http;
using Moq;

namespace Api.UnitTests.Authorization;

public class OrganizationPermissionsTests
{
    [Theory]
    [InlineData("JWT", true, true)]
    [InlineData("JWT", false, true)]
    [InlineData("JWT", true, false)]
    [InlineData("token", true, true)]
    public async Task ForeignOrganizationRequiresJwtMembershipAndSameWorkspace(string auth, bool member, bool sameWorkspace)
    {
        var workspace = Guid.NewGuid();
        var org = new Organization(sameWorkspace ? workspace : Guid.NewGuid(), "Org", "org") { Id = Guid.NewGuid() };
        var user = Guid.NewGuid();
        var context = new DefaultHttpContext();
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspace.ToString();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = Guid.NewGuid().ToString();
        context.User = new(new ClaimsIdentity([new Claim(UserClaims.Id, user.ToString())], auth == "JWT" ? Schemes.JwtBearer : Schemes.OpenApi));
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
            .ReturnsAsync((Expression<Func<Organization, bool>> p) => p.Compile()(org) ? org : null);
        organizations.Setup(x => x.ContainsUserAsync(org.Id, user)).ReturnsAsync(member);
        var members = new Mock<IMemberService>();
        PolicyStatement[] policies = [new() { Actions = ["*"], Resources = ["*"] }];
        members.Setup(x => x.GetPermissionsAsync(org.Id, user)).ReturnsAsync(policies);
        var requestPermissions = new Mock<IRequestPermissions>(MockBehavior.Strict);
        var provider = new Api.Authorization.OrganizationPermissions(new HttpContextAccessor { HttpContext = context }, requestPermissions.Object, organizations.Object, members.Object);
        var result = await provider.GetAsync(org.Id);
        var allowed = auth == "JWT" && member && sameWorkspace;
        Assert.Equal(allowed ? policies : [], result);
        await provider.GetAsync(org.Id);
        members.Verify(x => x.GetPermissionsAsync(org.Id, user), allowed ? Times.Once : Times.Never);
    }

    [Fact]
    public async Task CurrentOrganizationUsesRequestPermissionsIncludingTokenRestrictions()
    {
        var orgId = Guid.NewGuid();
        var context = new DefaultHttpContext();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = orgId.ToString();
        context.User = new(new ClaimsIdentity([], Schemes.OpenApi));
        PolicyStatement[] policies = [new() { Actions = ["limited"], Resources = ["limited"] }];
        var requests = new Mock<IRequestPermissions>();
        requests.Setup(x => x.GetAsync(context)).ReturnsAsync(policies);
        var members = new Mock<IMemberService>(MockBehavior.Strict);
        var provider = new Api.Authorization.OrganizationPermissions(new HttpContextAccessor { HttpContext = context }, requests.Object,
            Mock.Of<IOrganizationService>(), members.Object);
        Assert.Same(policies, await provider.GetAsync(orgId));
        members.VerifyNoOtherCalls();
    }
}
