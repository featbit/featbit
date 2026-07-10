using System.Security.Claims;
using Api;
using Api.Authorization;
using Application.Services;
using Domain.Workspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace Api.UnitTests.Authorization;

public class LicenseRequirementHandlerTests
{
    private static AuthorizationHandlerContext BuildContext(
        LicenseRequirement requirement,
        HttpContext? resource)
    {
        return new AuthorizationHandlerContext(
            new[] { requirement },
            new ClaimsPrincipal(new ClaimsIdentity()),
            resource);
    }

    [Fact]
    public async Task HandleAsync_ResourceIsNotHttpContext_DoesNotSucceed()
    {
        var licenseSvc = new Mock<ILicenseService>();
        var sut = new LicenseRequirementHandler(licenseSvc.Object);
        var requirement = new LicenseRequirement(LicenseFeatures.ChangeRequest);
        var ctx = BuildContext(requirement, resource: null);

        await sut.HandleAsync(ctx);

        Assert.False(ctx.HasSucceeded);
        licenseSvc.Verify(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_MissingWorkspaceHeader_DoesNotSucceed()
    {
        var licenseSvc = new Mock<ILicenseService>();
        var sut = new LicenseRequirementHandler(licenseSvc.Object);
        var requirement = new LicenseRequirement(LicenseFeatures.ChangeRequest);
        var http = new DefaultHttpContext();
        var ctx = BuildContext(requirement, http);

        await sut.HandleAsync(ctx);

        Assert.False(ctx.HasSucceeded);
        licenseSvc.Verify(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_MalformedWorkspaceHeader_DoesNotSucceed()
    {
        var licenseSvc = new Mock<ILicenseService>();
        var sut = new LicenseRequirementHandler(licenseSvc.Object);
        var requirement = new LicenseRequirement(LicenseFeatures.ChangeRequest);
        var http = new DefaultHttpContext();
        http.Request.Headers[ApiConstants.WorkspaceHeaderKey] = "not-a-guid";
        var ctx = BuildContext(requirement, http);

        await sut.HandleAsync(ctx);

        Assert.False(ctx.HasSucceeded);
        licenseSvc.Verify(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task HandleAsync_FeatureGranted_Succeeds()
    {
        var workspaceId = Guid.NewGuid();
        var licenseSvc = new Mock<ILicenseService>();
        licenseSvc.Setup(x => x.IsFeatureGrantedAsync(workspaceId, LicenseFeatures.ChangeRequest))
            .ReturnsAsync(true);

        var sut = new LicenseRequirementHandler(licenseSvc.Object);
        var requirement = new LicenseRequirement(LicenseFeatures.ChangeRequest);
        var http = new DefaultHttpContext();
        http.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceId.ToString();
        var ctx = BuildContext(requirement, http);

        await sut.HandleAsync(ctx);

        Assert.True(ctx.HasSucceeded);
    }

    [Fact]
    public async Task HandleAsync_FeatureNotGranted_DoesNotSucceed()
    {
        var workspaceId = Guid.NewGuid();
        var licenseSvc = new Mock<ILicenseService>();
        licenseSvc.Setup(x => x.IsFeatureGrantedAsync(workspaceId, LicenseFeatures.ChangeRequest))
            .ReturnsAsync(false);

        var sut = new LicenseRequirementHandler(licenseSvc.Object);
        var requirement = new LicenseRequirement(LicenseFeatures.ChangeRequest);
        var http = new DefaultHttpContext();
        http.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceId.ToString();
        var ctx = BuildContext(requirement, http);

        await sut.HandleAsync(ctx);

        Assert.False(ctx.HasSucceeded);
    }
}
