using Api.Authorization;
using Api.Mcp;
using Application.Experiments;
using Application.Services;
using MediatR;
using Microsoft.AspNetCore.Http;
using Moq;

namespace Application.IntegrationTests.Mcp;

public class ExperimentMcpToolsTests
{
    private const string ValidSamplingPlan =
        """[{"variation":"control","role":"control","includeRate":11.111111},{"variation":"treatment","role":"treatment","includeRate":100}]""";

    [Fact]
    public async Task GetExperimentResolvesEnvAndChecksPermissionBeforeDispatch()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<GetExperiment>(request =>
                request.EnvId == envId &&
                request.Id == experimentId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExperimentDetailVm { Id = experimentId, FeatBitEnvId = envId });
        var tools = new ExperimentMcpTools(
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
        var experimentService = new Mock<IExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(false);
        var tools = new ExperimentMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => tools.GetExperiment(experimentId));
        sender.Verify(x => x.Send(It.IsAny<IRequest<ExperimentDetailVm>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateRunTrafficDispatchesAudienceUpdateWithSamplingFields()
    {
        var experimentId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var detail = ExperimentDetail(experimentId, envId, runId, "draft");

        experimentService.Setup(x => x.GetEnvIdAsync(experimentId)).ReturnsAsync(envId);
        experimentService.Setup(x => x.GetAsync(envId, experimentId)).ReturnsAsync(detail);
        permissionChecker.Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>())).ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<UpdateExperimentRunAudience>(request =>
                request.EnvId == envId &&
                request.Id == experimentId &&
                request.RunId == runId &&
                request.Update.Method == "bayesian_ab" &&
                request.Update.ControlVariant == "control" &&
                request.Update.TreatmentVariant == "treatment" &&
                request.Update.LayerKey == "checkout" &&
                request.Update.LayerId == "checkout" &&
                request.Update.AssignmentUnitSelector == "user.keyId" &&
                request.Update.LayerTrafficPercent == 30 &&
                request.Update.AnalysisSamplingPlan == ValidSamplingPlan &&
                request.Update.AllocationPlan == null), It.IsAny<CancellationToken>()))
            .ReturnsAsync(detail);

        var tools = new ExperimentMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object);

        var result = await tools.UpdateRunTraffic(experimentId, runId, new ExperimentMcpRunTrafficRequest
        {
            Method = "bayesian_ab",
            ControlVariant = "control",
            TreatmentVariant = "treatment",
            LayerKey = "checkout",
            AssignmentUnitSelector = "user.keyId",
            LayerTrafficPercent = 30,
            AnalysisSamplingPlan = ValidSamplingPlan
        });

        Assert.Equal(experimentId, result.Id);
        sender.VerifyAll();
    }

    [Fact]
    public async Task UpdateRunTrafficRequiresConfirmationWhenRunAlreadyCollecting()
    {
        var experimentId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        experimentService.Setup(x => x.GetEnvIdAsync(experimentId)).ReturnsAsync(envId);
        experimentService.Setup(x => x.GetAsync(envId, experimentId)).ReturnsAsync(ExperimentDetail(experimentId, envId, runId, "collecting"));
        permissionChecker.Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>())).ReturnsAsync(true);
        var tools = new ExperimentMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object);

        await Assert.ThrowsAsync<InvalidOperationException>(() => tools.UpdateRunTraffic(experimentId, runId, new ExperimentMcpRunTrafficRequest
        {
            Method = "bayesian_ab",
            ControlVariant = "control",
            TreatmentVariant = "treatment",
            AssignmentUnitSelector = "user.keyId",
            LayerTrafficPercent = 100,
            AnalysisSamplingPlan = ValidSamplingPlan
        }));

        sender.Verify(x => x.Send(It.IsAny<IRequest<ExperimentDetailVm>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("""[{"variation":"control","role":"control","includeRate":101},{"variation":"treatment","role":"treatment","includeRate":100}]""")]
    [InlineData("""[{"variation":"control","role":"control","includeRate":100}]""")]
    [InlineData("not-json")]
    public async Task UpdateRunTrafficRejectsInvalidSamplingPlan(string samplingPlan)
    {
        var experimentId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        experimentService.Setup(x => x.GetEnvIdAsync(experimentId)).ReturnsAsync(envId);
        experimentService.Setup(x => x.GetAsync(envId, experimentId)).ReturnsAsync(ExperimentDetail(experimentId, envId, runId, "draft"));
        permissionChecker.Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>())).ReturnsAsync(true);
        var tools = new ExperimentMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object);

        await Assert.ThrowsAsync<ArgumentException>(() => tools.UpdateRunTraffic(experimentId, runId, new ExperimentMcpRunTrafficRequest
        {
            Method = "bayesian_ab",
            ControlVariant = "control",
            TreatmentVariant = "treatment",
            AssignmentUnitSelector = "user.keyId",
            LayerTrafficPercent = 100,
            AnalysisSamplingPlan = samplingPlan
        }));

        sender.Verify(x => x.Send(It.IsAny<IRequest<ExperimentDetailVm>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static ExperimentDetailVm ExperimentDetail(Guid experimentId, Guid envId, Guid runId, string runStatus)
    {
        return new ExperimentDetailVm
        {
            Id = experimentId,
            FeatBitEnvId = envId,
            ExperimentRuns =
            [
                new ExperimentRunVm
                {
                    Id = runId,
                    ExperimentId = experimentId,
                    Status = runStatus,
                    Slug = "run-1",
                    Method = "bayesian_ab",
                    ControlVariant = "control",
                    TreatmentVariant = "treatment"
                }
            ]
        };
    }
}
