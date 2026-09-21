using Api.Authorization;
using Api.Mcp;
using Application.Experiments;
using Application.Services;
using MediatR;
using Microsoft.AspNetCore.Http;
using Moq;

namespace Api.UnitTests.Mcp;

public class ExperimentMcpToolsTests
{
    [Fact]
    public async Task UpdateMetrics_ExposesCurrentSchema_AndDispatchesSelectors()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var update = new ExperimentMetricsUpdate
        {
            PrimaryMetric = new PrimaryMetricSelection { MetricId = Guid.NewGuid(), ExpectedDirection = "increase_good" },
            GuardrailMetrics = [new GuardrailMetricSelection { MetricId = Guid.NewGuid(), Direction = "decrease_bad" }]
        };
        var context = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var service = new Mock<IExperimentService>();
        var permissions = new Mock<IPermissionChecker>();
        service.Setup(x => x.GetEnvIdAsync(experimentId)).ReturnsAsync(envId);
        permissions.Setup(x => x.IsGrantedAsync(context, It.IsAny<PermissionRequirement>())).ReturnsAsync(true);
        sender.Setup(x => x.Send(It.Is<UpdateExperimentMetrics>(request =>
                request.Id == experimentId && request.EnvId == envId && request.Update == update),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExperimentDetailVm { Id = experimentId });
        var tools = new ExperimentMcpTools(sender.Object, service.Object,
            new HttpContextAccessor { HttpContext = context }, permissions.Object);
        var tool = ModelContextProtocol.Server.McpServerTool.Create(tools.UpdateMetrics);
        var properties = tool.ProtocolTool.InputSchema.GetProperty("properties")
            .GetProperty("update").GetProperty("properties");

        Assert.Equal(new[] { "guardrailMetrics", "primaryMetric" },
            properties.EnumerateObject().Select(property => property.Name).OrderBy(name => name));
        Assert.Equal(new[] { "expectedDirection", "metricId" },
            properties.GetProperty("primaryMetric").GetProperty("properties")
                .EnumerateObject().Select(property => property.Name).OrderBy(name => name));
        var guardrailSchema = properties.GetProperty("guardrailMetrics");
        var guardrailTypes = guardrailSchema.GetProperty("type").EnumerateArray().Select(type => type.GetString()).ToArray();
        Assert.Contains("array", guardrailTypes);
        Assert.DoesNotContain("string", guardrailTypes);
        Assert.Equal(new[] { "direction", "metricId" },
            guardrailSchema.GetProperty("items").GetProperty("properties")
                .EnumerateObject().Select(property => property.Name).OrderBy(name => name));

        var result = await tools.UpdateMetrics(experimentId, update);
        Assert.Equal(experimentId, result.Id);
        sender.VerifyAll();
    }

    [Fact]
    public async Task UpdateExperiment_ExposesFlagIdInSchema_AndDispatchesIt()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var context = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var service = new Mock<IExperimentService>();
        var permissions = new Mock<IPermissionChecker>();
        service.Setup(x => x.GetEnvIdAsync(experimentId)).ReturnsAsync(envId);
        permissions.Setup(x => x.IsGrantedAsync(context, It.IsAny<PermissionRequirement>())).ReturnsAsync(true);
        sender.Setup(x => x.Send(It.Is<UpdateExperiment>(request =>
                request.Id == experimentId && request.EnvId == envId && request.Update.FlagId == flagId),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ExperimentDetailVm { Id = experimentId, FlagId = flagId, FlagKey = "checkout" });
        var tools = new ExperimentMcpTools(sender.Object, service.Object,
            new HttpContextAccessor { HttpContext = context }, permissions.Object);
        var tool = ModelContextProtocol.Server.McpServerTool.Create(tools.UpdateExperiment);
        var properties = tool.ProtocolTool.InputSchema.GetProperty("properties")
            .GetProperty("update").GetProperty("properties");
        Assert.True(properties.TryGetProperty("flagId", out _));
        Assert.False(properties.TryGetProperty("flagKey", out _));

        var result = await tools.UpdateExperiment(experimentId, new ExperimentUpdate { FlagId = flagId });
        Assert.Equal(flagId, result.FlagId);
        Assert.Equal("checkout", result.FlagKey);
        sender.VerifyAll();
    }

    private const string ValidSamplingPlan =
        """[{"variation":"control","role":"control","includeRate":11.111111},{"variation":"treatment","role":"treatment","includeRate":100}]""";

    [Fact]
    public async Task GetExperiment_ValidContext_ResolvesEnvironmentAndChecksPermission()
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
            .ReturnsAsync(new ExperimentDetailVm { Id = experimentId, EnvId = envId });
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
    public async Task GetExperiment_PermissionDenied_Throws()
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
    public async Task UpdateRunTraffic_AnalysisScope_DoesNotRequireConfirmationOrChangeFlag()
    {
        var experimentId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var layerId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var detail = ExperimentDetail(experimentId, envId, runId);

        experimentService.Setup(x => x.GetEnvIdAsync(experimentId)).ReturnsAsync(envId);
        experimentService.Setup(x => x.GetAsync(envId, experimentId)).ReturnsAsync(detail);
        permissionChecker.Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>())).ReturnsAsync(true);
        UpdateExperimentRunAudience? dispatched = null;
        sender
            .Setup(x => x.Send(It.IsAny<UpdateExperimentRunAudience>(), It.IsAny<CancellationToken>()))
            .Callback<IRequest<ExperimentDetailVm>, CancellationToken>(
                (request, _) => dispatched = Assert.IsType<UpdateExperimentRunAudience>(request))
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
            TreatmentVariants = ["treatment"],
            LayerId = layerId,
            LayerKey = "checkout",
            AssignmentUnitSelector = "user.keyId",
            LayerTrafficPercent = 30,
            AnalysisSamplingPlan = ValidSamplingPlan
        });

        Assert.Equal(experimentId, result.Id);
        Assert.NotNull(dispatched);
        Assert.Equal(envId, dispatched.EnvId);
        Assert.Equal(experimentId, dispatched.Id);
        Assert.Equal(runId, dispatched.RunId);
        Assert.Equal("bayesian_ab", dispatched.Update.Method);
        Assert.Equal("control", dispatched.Update.ControlVariant);
        Assert.Equal(new string[] { "treatment" }, dispatched.Update.TreatmentVariants);
        Assert.Equal("checkout", dispatched.Update.LayerKey);
        Assert.Equal(layerId, dispatched.Update.LayerId);
        Assert.Equal("user.keyId", dispatched.Update.AssignmentUnitSelector);
        Assert.Equal(30, dispatched.Update.LayerTrafficPercent);
        Assert.Equal(ValidSamplingPlan, dispatched.Update.AnalysisSamplingPlan);
        Assert.Null(dispatched.Update.AllocationPlan);
        Assert.Single(sender.Invocations); // Only the analysis audience command is dispatched.
    }

    [Theory]
    [InlineData("""[{"variation":"control","role":"control","includeRate":101},{"variation":"treatment","role":"treatment","includeRate":100}]""")]
    [InlineData("""[{"variation":"control","role":"control","includeRate":100}]""")]
    [InlineData("not-json")]
    public async Task UpdateRunTraffic_InvalidSamplingPlan_Throws(string samplingPlan)
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
        experimentService.Setup(x => x.GetAsync(envId, experimentId)).ReturnsAsync(ExperimentDetail(experimentId, envId, runId));
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
            TreatmentVariants = ["treatment"],
            AssignmentUnitSelector = "user.keyId",
            LayerTrafficPercent = 100,
            AnalysisSamplingPlan = samplingPlan
        }));

        sender.Verify(x => x.Send(It.IsAny<IRequest<ExperimentDetailVm>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static ExperimentDetailVm ExperimentDetail(Guid experimentId, Guid envId, Guid runId)
    {
        return new ExperimentDetailVm
        {
            Id = experimentId,
            EnvId = envId,
            ExperimentRuns =
            [
                new ExperimentRunVm
                {
                    Id = runId,
                    ExperimentId = experimentId,
                    Slug = "run-1",
                    Method = "bayesian_ab",
                    ControlVariant = "control",
                    TreatmentVariants = ["treatment"]
                }
            ]
        };
    }
}
