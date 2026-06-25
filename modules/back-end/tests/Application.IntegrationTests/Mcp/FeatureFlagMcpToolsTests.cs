using Api;
using Api.Authorization;
using Api.Mcp;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Workspaces;
using MediatR;
using Microsoft.AspNetCore.Http;
using Moq;

namespace Application.IntegrationTests.Mcp;

public class FeatureFlagMcpToolsTests
{
    [Fact]
    public async Task CreateFeatureFlagResolvesEnvAndChecksCreateFlagPermission()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var licenseService = new Mock<ILicenseService>();
        var requestPermissions = new Mock<IRequestPermissions>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var createdFlag = new FeatureFlag { EnvId = envId, Key = "checkout-redesign" };

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<CreateFeatureFlag>(request =>
                request.EnvId == envId &&
                request.Key == "checkout-redesign" &&
                request.VariationType == VariationTypes.Boolean &&
                request.Variations.Count == 2), It.IsAny<CancellationToken>()))
            .ReturnsAsync(createdFlag);
        var tools = new FeatureFlagMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object,
            licenseService.Object,
            requestPermissions.Object);

        var result = await tools.CreateFeatureFlag(experimentId, new FeatureFlagMcpCreateRequest
        {
            ConfirmedByUser = true,
            Name = "Checkout redesign",
            Key = "checkout-redesign"
        });

        Assert.Equal(createdFlag, result);
        Assert.Equal(envId.ToString(), httpContext.Request.RouteValues["envId"]);
        Assert.False(httpContext.Request.RouteValues.ContainsKey("key"));
        permissionChecker.Verify(
            x => x.IsGrantedAsync(httpContext, It.Is<PermissionRequirement>(r => r.PermissionName == Permissions.CanAccessEnv)),
            Times.Once);
        permissionChecker.Verify(
            x => x.IsGrantedAsync(httpContext, It.Is<PermissionRequirement>(r => r.PermissionName == Permissions.CreateFlag)),
            Times.Once);
    }

    [Fact]
    public async Task CreateFeatureFlagRequiresUserConfirmation()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var tools = new FeatureFlagMcpTools(
            sender.Object,
            experimentService.Object,
            new HttpContextAccessor { HttpContext = httpContext },
            permissionChecker.Object,
            Mock.Of<ILicenseService>(),
            Mock.Of<IRequestPermissions>());

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);

        var ex = await Assert.ThrowsAsync<BusinessException>(() => tools.CreateFeatureFlag(
            experimentId,
            new FeatureFlagMcpCreateRequest
            {
                Name = "Checkout redesign",
                Key = "checkout-redesign"
            }));

        Assert.Equal(ErrorCodes.Required("confirmedByUser"), ex.Message);
        sender.Verify(x => x.Send(It.IsAny<CreateFeatureFlag>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateFeatureFlagTargetingAppliesDirectlyWhenReviewersAreNotProvided()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var revision = Guid.NewGuid();
        var nextRevision = Guid.NewGuid();
        const string key = "checkout-redesign";
        const string controlVariationId = "control";
        const string treatmentVariationId = "treatment";

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[ApiConstants.OrgIdHeaderKey] = orgId.ToString();

        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var licenseService = new Mock<ILicenseService>();
        var requestPermissions = new Mock<IRequestPermissions>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var flag = CreateFlag(envId, key, revision, controlVariationId, treatmentVariationId);
        var targeting = CreateTenPercentTreatmentTargeting(controlVariationId, treatmentVariationId);

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);
        requestPermissions
            .Setup(x => x.GetAsync(httpContext))
            .ReturnsAsync([]);
        sender
            .Setup(x => x.Send(It.Is<GetFeatureFlag>(request =>
                request.EnvId == envId &&
                request.Key == key), It.IsAny<CancellationToken>()))
            .ReturnsAsync(flag);
        sender
            .Setup(x => x.Send(It.Is<UpdateTargeting>(request =>
                request.OrgId == orgId &&
                request.EnvId == envId &&
                request.Key == key &&
                request.Revision == revision &&
                request.Targeting == targeting &&
                request.Comment == "Apply 10% treatment rollout"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(nextRevision);
        var tools = new FeatureFlagMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object,
            licenseService.Object,
            requestPermissions.Object);

        var result = await tools.UpdateFeatureFlagTargeting(
            experimentId,
            key,
            new FeatureFlagTargetingUpdateRequest
            {
                Revision = revision,
                Targeting = targeting,
                ConfirmedByUser = true,
                Comment = "Apply 10% treatment rollout"
            });

        Assert.Equal(FeatureFlagTargetingUpdateModes.Direct, result.Mode);
        Assert.Equal(nextRevision, result.Revision);
        sender.Verify(x => x.Send(It.IsAny<UpdateTargeting>(), It.IsAny<CancellationToken>()), Times.Once);
        sender.Verify(x => x.Send(It.IsAny<CreateFlagChangeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
        licenseService.Verify(
            x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateFeatureFlagTargetingRequiresUserConfirmation()
    {
        var tools = new FeatureFlagMcpTools(
            Mock.Of<ISender>(),
            Mock.Of<IReleaseDecisionExperimentService>(),
            new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
            Mock.Of<IPermissionChecker>(),
            Mock.Of<ILicenseService>(),
            Mock.Of<IRequestPermissions>());

        var ex = await Assert.ThrowsAsync<BusinessException>(() => tools.UpdateFeatureFlagTargeting(
            Guid.NewGuid(),
            "checkout-redesign",
            new FeatureFlagTargetingUpdateRequest
            {
                Revision = Guid.NewGuid(),
                Targeting = new FlagTargeting()
            }));

        Assert.Equal(ErrorCodes.Required("confirmedByUser"), ex.Message);
    }

    [Fact]
    public async Task ToggleFeatureFlagChecksPermissionAndUsesExistingCommand()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var revision = Guid.NewGuid();
        const string key = "checkout-redesign";

        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var licenseService = new Mock<ILicenseService>();
        var requestPermissions = new Mock<IRequestPermissions>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<ToggleFeatureFlag>(request =>
                request.EnvId == envId &&
                request.Key == key &&
                request.Status &&
                request.Comment == "Enable for experiment traffic"), It.IsAny<CancellationToken>()))
            .ReturnsAsync(revision);
        var tools = new FeatureFlagMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object,
            licenseService.Object,
            requestPermissions.Object);

        var result = await tools.ToggleFeatureFlag(
            experimentId,
            key,
            new FeatureFlagToggleRequest
            {
                ConfirmedByUser = true,
                IsEnabled = true,
                Comment = "Enable for experiment traffic"
            });

        Assert.True(result.IsEnabled);
        Assert.Equal(revision, result.Revision);
        Assert.Equal(envId.ToString(), httpContext.Request.RouteValues["envId"]);
        Assert.Equal(key, httpContext.Request.RouteValues["key"]);
        permissionChecker.Verify(
            x => x.IsGrantedAsync(httpContext, It.Is<PermissionRequirement>(r => r.PermissionName == Permissions.CanAccessEnv)),
            Times.Once);
        permissionChecker.Verify(
            x => x.IsGrantedAsync(httpContext, It.Is<PermissionRequirement>(r => r.PermissionName == Permissions.ToggleFlag)),
            Times.Once);
        sender.Verify(x => x.Send(It.IsAny<ToggleFeatureFlag>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ToggleFeatureFlagRequiresUserConfirmation()
    {
        var tools = new FeatureFlagMcpTools(
            Mock.Of<ISender>(),
            Mock.Of<IReleaseDecisionExperimentService>(),
            new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
            Mock.Of<IPermissionChecker>(),
            Mock.Of<ILicenseService>(),
            Mock.Of<IRequestPermissions>());

        var ex = await Assert.ThrowsAsync<BusinessException>(() => tools.ToggleFeatureFlag(
            Guid.NewGuid(),
            "checkout-redesign",
            new FeatureFlagToggleRequest { IsEnabled = true }));

        Assert.Equal(ErrorCodes.Required("confirmedByUser"), ex.Message);
    }

    [Fact]
    public async Task ToggleFeatureFlagRequiresEnabledStatus()
    {
        var tools = new FeatureFlagMcpTools(
            Mock.Of<ISender>(),
            Mock.Of<IReleaseDecisionExperimentService>(),
            new HttpContextAccessor { HttpContext = new DefaultHttpContext() },
            Mock.Of<IPermissionChecker>(),
            Mock.Of<ILicenseService>(),
            Mock.Of<IRequestPermissions>());

        var ex = await Assert.ThrowsAsync<BusinessException>(() => tools.ToggleFeatureFlag(
            Guid.NewGuid(),
            "checkout-redesign",
            new FeatureFlagToggleRequest { ConfirmedByUser = true }));

        Assert.Equal(ErrorCodes.Required("isEnabled"), ex.Message);
    }

    [Fact]
    public async Task UpdateFeatureFlagTargetingCreatesChangeRequestWhenReviewersAreProvided()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var workspaceId = Guid.NewGuid();
        var revision = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        const string key = "checkout-redesign";
        const string controlVariationId = "control";
        const string treatmentVariationId = "treatment";

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Headers[ApiConstants.OrgIdHeaderKey] = orgId.ToString();
        httpContext.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceId.ToString();

        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var licenseService = new Mock<ILicenseService>();
        var requestPermissions = new Mock<IRequestPermissions>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var flag = CreateFlag(envId, key, revision, controlVariationId, treatmentVariationId);
        var targeting = CreateTenPercentTreatmentTargeting(controlVariationId, treatmentVariationId);

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        licenseService
            .Setup(x => x.IsFeatureGrantedAsync(workspaceId, LicenseFeatures.ChangeRequest))
            .ReturnsAsync(true);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<GetFeatureFlag>(request =>
                request.EnvId == envId &&
                request.Key == key), It.IsAny<CancellationToken>()))
            .ReturnsAsync(flag);
        sender
            .Setup(x => x.Send(It.Is<CreateFlagChangeRequest>(request =>
                request.OrgId == orgId &&
                request.EnvId == envId &&
                request.Key == key &&
                request.Revision == revision &&
                request.Targeting == targeting &&
                request.Reason == "Start 10% treatment rollout" &&
                request.Reviewers.Single() == reviewerId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<GetPendingChanges>(request =>
                request.EnvId == envId &&
                request.Key == key), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        var tools = new FeatureFlagMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object,
            licenseService.Object,
            requestPermissions.Object);

        var result = await tools.UpdateFeatureFlagTargeting(
            experimentId,
            key,
            new FeatureFlagTargetingUpdateRequest
            {
                Revision = revision,
                Targeting = targeting,
                ConfirmedByUser = true,
                Reason = "Start 10% treatment rollout",
                Reviewers = [reviewerId]
            });

        Assert.Equal(FeatureFlagTargetingUpdateModes.ChangeRequest, result.Mode);
        Assert.Empty(result.PendingChanges);
        licenseService.Verify(x => x.IsFeatureGrantedAsync(workspaceId, LicenseFeatures.ChangeRequest), Times.Once);
        sender.Verify(x => x.Send(It.IsAny<UpdateTargeting>(), It.IsAny<CancellationToken>()), Times.Never);
        sender.Verify(x => x.Send(It.IsAny<CreateFlagChangeRequest>(), It.IsAny<CancellationToken>()), Times.Once);
        permissionChecker.Verify(
            x => x.IsGrantedAsync(httpContext, It.Is<PermissionRequirement>(r => r.PermissionName == Permissions.UpdateFlagDefaultRule)),
            Times.Once);
    }

    [Fact]
    public async Task UpdateFeatureFlagTargetingRejectsInvalidRollout()
    {
        var experimentId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var revision = Guid.NewGuid();
        const string key = "checkout-redesign";
        const string controlVariationId = "control";
        const string treatmentVariationId = "treatment";

        var httpContext = new DefaultHttpContext();
        var sender = new Mock<ISender>();
        var experimentService = new Mock<IReleaseDecisionExperimentService>();
        var permissionChecker = new Mock<IPermissionChecker>();
        var licenseService = new Mock<ILicenseService>();
        var requestPermissions = new Mock<IRequestPermissions>();
        var httpContextAccessor = new HttpContextAccessor { HttpContext = httpContext };
        var flag = CreateFlag(envId, key, revision, controlVariationId, treatmentVariationId);
        var targeting = CreateTenPercentTreatmentTargeting(controlVariationId, treatmentVariationId);
        targeting.Fallthrough.Variations.Last().Rollout = [0.9, 0.95];

        experimentService
            .Setup(x => x.GetEnvIdAsync(experimentId))
            .ReturnsAsync(envId);
        permissionChecker
            .Setup(x => x.IsGrantedAsync(httpContext, It.IsAny<PermissionRequirement>()))
            .ReturnsAsync(true);
        sender
            .Setup(x => x.Send(It.Is<GetFeatureFlag>(request =>
                request.EnvId == envId &&
                request.Key == key), It.IsAny<CancellationToken>()))
            .ReturnsAsync(flag);
        var tools = new FeatureFlagMcpTools(
            sender.Object,
            experimentService.Object,
            httpContextAccessor,
            permissionChecker.Object,
            licenseService.Object,
            requestPermissions.Object);

        var ex = await Assert.ThrowsAsync<BusinessException>(() => tools.UpdateFeatureFlagTargeting(
            experimentId,
            key,
            new FeatureFlagTargetingUpdateRequest
            {
                Revision = revision,
                Targeting = targeting,
                ConfirmedByUser = true
            }));

        Assert.Equal(ErrorCodes.Invalid("fallthrough.variations.rollout"), ex.Message);
        sender.Verify(x => x.Send(It.IsAny<UpdateTargeting>(), It.IsAny<CancellationToken>()), Times.Never);
        sender.Verify(x => x.Send(It.IsAny<CreateFlagChangeRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static FlagTargeting CreateTenPercentTreatmentTargeting(
        string controlVariationId,
        string treatmentVariationId)
    {
        return new FlagTargeting
        {
            TargetUsers = [],
            Rules = [],
            ExptIncludeAllTargets = true,
            Fallthrough = new Fallthrough
            {
                IncludedInExpt = true,
                Variations =
                [
                    new RolloutVariation { Id = controlVariationId, Rollout = [0, 0.9], ExptRollout = 0.9 },
                    new RolloutVariation { Id = treatmentVariationId, Rollout = [0.9, 1], ExptRollout = 0.1 }
                ]
            }
        };
    }

    private static FeatureFlag CreateFlag(
        Guid envId,
        string key,
        Guid revision,
        string controlVariationId,
        string treatmentVariationId)
    {
        return new FeatureFlag
        {
            Id = Guid.NewGuid(),
            EnvId = envId,
            Key = key,
            Name = "Checkout redesign",
            Description = string.Empty,
            Revision = revision,
            VariationType = VariationTypes.String,
            IsEnabled = false,
            DisabledVariationId = controlVariationId,
            Variations =
            [
                new Variation { Id = controlVariationId, Name = "Control", Value = "control" },
                new Variation { Id = treatmentVariationId, Name = "Treatment", Value = "treatment" }
            ],
            TargetUsers = [],
            Rules = [],
            Tags = [],
            Fallthrough = new Fallthrough
            {
                IncludedInExpt = true,
                Variations =
                [
                    new RolloutVariation { Id = controlVariationId, Rollout = [0, 1], ExptRollout = 1 }
                ]
            },
            ExptIncludeAllTargets = true
        };
    }
}
