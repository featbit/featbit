using Api.Authorization;
using Api.Mcp;
using Application.ReleaseDecisions;
using Application.Services;
using MediatR;
using Microsoft.AspNetCore.Http;
using Moq;

namespace Application.IntegrationTests.Mcp;

public class ReleaseDecisionMcpToolsTests
{
    [Fact]
    public async Task GetExperimentResolvesEnvAndChecksPermissionBeforeDispatch()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<GetReleaseDecisionExperiment>(request =>
                request.EnvId == envId &&
                request.Id == experimentId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReleaseDecisionExperimentDetailVm { Id = experimentId, FeatBitEnvId = envId });
        var tools = new ReleaseDecisionMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object);

        var result = await tools.GetExperiment(experimentId);

        Assert.Equal(experimentId, result.Id);
        Assert.Equal(envId.ToString(), httpContext.Request.RouteValues["envId"]);
        permissionChecker.Verify(
            x => x.IsGrantedAsync(httpContext, It.Is<PermissionRequirement>(r => r.PermissionName == Domain.Policies.Permissions.CanAccessEnv)),
            Times.Once);
    }

    [Fact]
    public async Task GetExperimentThrowsWhenPermissionIsDenied()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(false);
        var tools = new ReleaseDecisionMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => tools.GetExperiment(experimentId));
        sender.Verify(x => x.Send(It.IsAny<IRequest<ReleaseDecisionExperimentDetailVm>>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
