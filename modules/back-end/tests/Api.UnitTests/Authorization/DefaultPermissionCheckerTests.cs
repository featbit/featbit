using Api.Authorization;
using Application.Services;
using Domain.Policies;
using Domain.Resources;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging.Abstractions;

namespace Api.UnitTests.Authorization;

public class DefaultPermissionCheckerTests
{
    private static PolicyStatement[] AllowStatement(string permission, string resourcePattern) =>
    [
        new PolicyStatement
        {
            Id = Guid.NewGuid().ToString(),
            ResourceType = Permissions.ResourceMap[permission],
            Effect = EffectType.Allow,
            Actions = new[] { permission },
            Resources = new[] { resourcePattern }
        }
    ];

    private static (DefaultPermissionChecker sut,
        Mock<IResourceService> resourceSvc,
        Mock<IRequestPermissions> requestPermissions) BuildSut()
    {
        var resourceSvc = new Mock<IResourceService>();
        var requestPermissions = new Mock<IRequestPermissions>();
        var sut = new DefaultPermissionChecker(
            resourceSvc.Object,
            requestPermissions.Object,
            NullLogger<DefaultPermissionChecker>.Instance);
        return (sut, resourceSvc, requestPermissions);
    }

    private static HttpContext BuildHttpContext(params (string key, object value)[] routeValues)
    {
        var ctx = new DefaultHttpContext();
        var rd = new RouteData();
        foreach (var (key, value) in routeValues)
        {
            rd.Values[key] = value;
        }
        ctx.Features.Set<IRoutingFeature>(new RoutingFeature { RouteData = rd });
        // DefaultHttpContext.Request.RouteValues reads from the feature; set values directly:
        ctx.Request.RouteValues = rd.Values;
        return ctx;
    }

    private sealed class RoutingFeature : IRoutingFeature
    {
        public RouteData? RouteData { get; set; }
    }

    [Fact]
    public async Task IsGranted_NoStatements_ReturnsFalse()
    {
        var (sut, _, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.CreateFlag);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(Array.Empty<PolicyStatement>());

        var http = BuildHttpContext(("envId", Guid.NewGuid().ToString()), ("key", "flag"));
        var result = await sut.IsGrantedAsync(http, req);

        Assert.False(result);
    }

    [Fact]
    public async Task IsGranted_WorkspacePermission_UsesWorkspaceWildcardRn()
    {
        var (sut, _, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.UpdateWorkspaceGeneralSettings);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.UpdateWorkspaceGeneralSettings, "workspace/*"));

        var result = await sut.IsGrantedAsync(BuildHttpContext(), req);

        Assert.True(result);
    }

    [Fact]
    public async Task IsGranted_IamPermission_UsesIamWildcardRn()
    {
        var (sut, _, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.CanManageIAM);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.CanManageIAM, "iam/*"));

        var result = await sut.IsGrantedAsync(BuildHttpContext(), req);

        Assert.True(result);
    }

    [Fact]
    public async Task IsGranted_CreateProject_UsesProjectWildcardRn()
    {
        var (sut, _, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.CreateProject);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.CreateProject, "project/*"));

        var result = await sut.IsGrantedAsync(BuildHttpContext(), req);

        Assert.True(result);
    }

    [Fact]
    public async Task IsGranted_ProjectPermission_LooksUpProjectRnByRouteId()
    {
        var projectId = Guid.NewGuid();
        var projectRn = $"project/{projectId}";
        var (sut, resourceSvc, perms) = BuildSut();
        resourceSvc.Setup(x => x.GetProjectRnAsync(projectId)).ReturnsAsync(projectRn);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.DeleteProject, projectRn));

        var req = new PermissionRequirement(Permissions.DeleteProject);
        var http = BuildHttpContext(("projectId", projectId.ToString()));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.True(result);
        resourceSvc.Verify(x => x.GetProjectRnAsync(projectId), Times.Once);
    }

    [Fact]
    public async Task IsGranted_ProjectPermission_InvalidProjectIdInRoute_ReturnsFalseWithoutLookup()
    {
        var (sut, resourceSvc, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.DeleteProject);
        var http = BuildHttpContext(("projectId", "not-a-guid"));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.False(result);
        resourceSvc.Verify(x => x.GetProjectRnAsync(It.IsAny<Guid>()), Times.Never);
        perms.Verify(x => x.GetAsync(It.IsAny<HttpContext>()), Times.Never);
    }

    [Fact]
    public async Task IsGranted_CreateEnv_AppendsEnvWildcardToProjectRn()
    {
        var projectId = Guid.NewGuid();
        var projectRn = $"project/{projectId}";
        var (sut, resourceSvc, perms) = BuildSut();
        resourceSvc.Setup(x => x.GetProjectRnAsync(projectId)).ReturnsAsync(projectRn);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.CreateEnv, projectRn));

        var req = new PermissionRequirement(Permissions.CreateEnv);
        var http = BuildHttpContext(("projectId", projectId.ToString()));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.True(result);
    }

    [Fact]
    public async Task IsGranted_EnvPermission_LooksUpEnvRnByRouteId()
    {
        var envId = Guid.NewGuid();
        var envRn = $"project/p:env/{envId}";
        var (sut, resourceSvc, perms) = BuildSut();
        resourceSvc.Setup(x => x.GetEnvRnAsync(envId)).ReturnsAsync(envRn);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.DeleteEnv, envRn));

        var req = new PermissionRequirement(Permissions.DeleteEnv);
        var http = BuildHttpContext(("envId", envId.ToString()));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.True(result);
        resourceSvc.Verify(x => x.GetEnvRnAsync(envId), Times.Once);
    }

    [Fact]
    public async Task IsGranted_EnvPermission_InvalidEnvIdInRoute_ReturnsFalseWithoutLookup()
    {
        var (sut, resourceSvc, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.DeleteEnv);
        var http = BuildHttpContext(("envId", "not-a-guid"));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.False(result);
        resourceSvc.Verify(x => x.GetEnvRnAsync(It.IsAny<Guid>()), Times.Never);
        perms.Verify(x => x.GetAsync(It.IsAny<HttpContext>()), Times.Never);
    }

    [Fact]
    public async Task IsGranted_FlagPermission_WithEnvIdButNoKey_UsesEnvLevelFlagWildcard()
    {
        var envId = Guid.NewGuid();
        var envRn = $"project/p:env/{envId}";
        var allFlagRN = $"{envRn}:flag/*";
        var (sut, resourceSvc, perms) = BuildSut();
        resourceSvc.Setup(x => x.GetEnvRnAsync(envId)).ReturnsAsync(envRn);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.CreateFlag, allFlagRN));

        var req = new PermissionRequirement(Permissions.CreateFlag);
        var http = BuildHttpContext(("envId", envId.ToString()));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.True(result);
    }

    [Fact]
    public async Task IsGranted_FlagPermission_WithEnvIdAndKey_UsesFullFlagRn()
    {
        var envId = Guid.NewGuid();
        var key = "my-flag";
        var flagRn = $"project/p:env/{envId}:flag/{key}";
        var (sut, resourceSvc, perms) = BuildSut();
        resourceSvc.Setup(x => x.GetFlagRnAsync(envId, key)).ReturnsAsync(flagRn);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.ToggleFlag, flagRn));

        var req = new PermissionRequirement(Permissions.ToggleFlag);
        var http = BuildHttpContext(("envId", envId.ToString()), ("key", key));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.True(result);
        resourceSvc.Verify(x => x.GetFlagRnAsync(envId, key), Times.Once);
        resourceSvc.Verify(x => x.GetEnvRnAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task IsGranted_FlagPermission_MissingEnvId_ReturnsFalse()
    {
        var (sut, resourceSvc, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.CreateFlag);

        var result = await sut.IsGrantedAsync(BuildHttpContext(), req);

        Assert.False(result);
        resourceSvc.Verify(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
        resourceSvc.Verify(x => x.GetEnvRnAsync(It.IsAny<Guid>()), Times.Never);
        perms.Verify(x => x.GetAsync(It.IsAny<HttpContext>()), Times.Never);
    }

    [Fact]
    public async Task IsGranted_SegmentPermission_WithEnvIdButNoSegmentId_UsesEnvLevelSegmentWildcard()
    {
        var envId = Guid.NewGuid();
        var envRn = $"project/p:env/{envId}";
        var allSegmentRN = $"{envRn}:segment/*";
        var (sut, resourceSvc, perms) = BuildSut();
        resourceSvc.Setup(x => x.GetEnvRnAsync(envId)).ReturnsAsync(envRn);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.CreateSegment, allSegmentRN));

        var req = new PermissionRequirement(Permissions.CreateSegment);
        var http = BuildHttpContext(("envId", envId.ToString()));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.True(result);
    }

    [Fact]
    public async Task IsGranted_SegmentPermission_WithEnvIdAndSegmentId_UsesFullSegmentRn()
    {
        var envId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();
        var segmentRn = $"project/p:env/{envId}:segment/{segmentId}";
        var allSegmentRN = $"project/p:env/{envId}:segment/*";
        var (sut, resourceSvc, perms) = BuildSut();
        resourceSvc.Setup(x => x.GetSegmentRnAsync(envId, segmentId)).ReturnsAsync(segmentRn);
        perms.Setup(x => x.GetAsync(It.IsAny<HttpContext>()))
            .ReturnsAsync(AllowStatement(Permissions.DeleteSegment, allSegmentRN));

        var req = new PermissionRequirement(Permissions.DeleteSegment);
        var http = BuildHttpContext(
            ("envId", envId.ToString()),
            ("segmentId", segmentId.ToString()));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.True(result);
    }

    [Fact]
    public async Task IsGranted_SegmentPermission_InvalidSegmentId_ReturnsFalse()
    {
        var (sut, resourceSvc, perms) = BuildSut();
        var req = new PermissionRequirement(Permissions.DeleteSegment);
        var http = BuildHttpContext(
            ("envId", Guid.NewGuid().ToString()),
            ("segmentId", "not-a-guid"));

        var result = await sut.IsGrantedAsync(http, req);

        Assert.False(result);
        resourceSvc.Verify(x => x.GetSegmentRnAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        perms.Verify(x => x.GetAsync(It.IsAny<HttpContext>()), Times.Never);
    }
}
