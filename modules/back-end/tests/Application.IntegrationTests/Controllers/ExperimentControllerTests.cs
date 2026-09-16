using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Api.Controllers;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Experiments;
using Application.Services;
using Domain.AccessTokens;
using Domain.Organizations;
using Domain.Policies;
using Domain.Resources;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Collection(nameof(TestApp))]
[Trait("Category", "Host")]
public class ExperimentControllerTests
{
    private const string PersonalToken = "api-experiment-test";
    private static readonly Guid ExperimentId = new("10000000-0000-0000-0000-000000000001");
    private static readonly Guid RunId = new("20000000-0000-0000-0000-000000000001");
    private static readonly string BasePath = $"/api/v1/envs/{TestWorkspace.Id}/experiments";
    private readonly TestApp _app;

    public ExperimentControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Create_RequestValidation()
    {
        using var factory = CreateFactory(Mock.Of<IExperimentService>());
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PostAsJsonAsync(BasePath, new { name = " " });

        await Verify(response);
    }

    [Fact]
    public async Task CreateUpdateAndFilter_UseFlagId_AndReturnResolvedDisplayFields()
    {
        var flagId = Guid.NewGuid();
        var service = new Mock<IExperimentService>();
        var detail = new ExperimentDetailVm
        {
            Id = ExperimentId, EnvId = TestWorkspace.Id, FlagId = flagId,
            FlagKey = "checkout", FlagName = "Checkout flow"
        };
        service.Setup(x => x.CreateAsync(It.Is<Domain.Experiments.Experiment>(experiment =>
                experiment.EnvId == TestWorkspace.Id && experiment.FlagId == flagId)))
            .ReturnsAsync(detail);
        service.Setup(x => x.UpdateAsync(TestWorkspace.Id, ExperimentId,
                It.Is<ExperimentUpdate>(update => update.FlagId == flagId)))
            .ReturnsAsync(detail);
        service.Setup(x => x.GetListAsync(TestWorkspace.Id,
                It.Is<ExperimentFilter>(filter => filter.FlagId == flagId)))
            .ReturnsAsync(new PagedResult<ExperimentVm>(1, [detail]));
        using var factory = CreateFactory(service.Object);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        using var created = await client.PostAsJsonAsync(BasePath, new { name = "Checkout", flagId });
        Assert.True(created.IsSuccessStatusCode);
        using var updated = await client.PutAsJsonAsync($"{BasePath}/{ExperimentId}", new { flagId });
        Assert.True(updated.IsSuccessStatusCode);
        using var payload = System.Text.Json.JsonDocument.Parse(await updated.Content.ReadAsStringAsync());
        var data = payload.RootElement.GetProperty("data");
        Assert.Equal(flagId, data.GetProperty("flagId").GetGuid());
        Assert.Equal("checkout", data.GetProperty("flagKey").GetString());
        Assert.Equal("Checkout flow", data.GetProperty("flagName").GetString());
        using var listed = await client.GetAsync($"{BasePath}?flagId={flagId}");
        Assert.True(listed.IsSuccessStatusCode);
        service.VerifyAll();
    }

    [Fact]
    public async Task FeatureFlagById_RequiresAuthentication_AndScopesTheLookupToEnvironment()
    {
        var flag = new Domain.FeatureFlags.FeatureFlag
        {
            Id = Guid.NewGuid(), EnvId = TestWorkspace.Id, Key = "checkout", Name = "Checkout flow"
        };
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Domain.FeatureFlags.FeatureFlag, bool>>>()))
            .ReturnsAsync((Expression<Func<Domain.FeatureFlags.FeatureFlag, bool>> predicate) =>
                predicate.Compile()(flag) ? flag : null);
        using var factory = _app.WithServices(services => services.Replace(ServiceDescriptor.Scoped(_ => service.Object)));
        var path = $"/api/v1/envs/{flag.EnvId}/feature-flags/by-id/{flag.Id}";
        using var anonymous = factory.CreateClient();
        Assert.Equal(System.Net.HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);
        using var found = await client.GetAsync(path);
        Assert.True(found.IsSuccessStatusCode);
        using var payload = System.Text.Json.JsonDocument.Parse(await found.Content.ReadAsStringAsync());
        Assert.Equal(flag.Id, payload.RootElement.GetProperty("data").GetProperty("id").GetGuid());
        using var missing = await client.GetAsync($"/api/v1/envs/{Guid.NewGuid()}/feature-flags/by-id/{flag.Id}");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Update_RequestValidation()
    {
        using var factory = CreateFactory(Mock.Of<IExperimentService>());
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PutAsJsonAsync($"{BasePath}/{ExperimentId}", new
        {
            primaryMetric = "activation",
            guardrails = "[]"
        });

        await Verify(response);
    }

    [Fact]
    public async Task UpdateMetrics_RequestValidation()
    {
        using var factory = CreateFactory(Mock.Of<IExperimentService>());
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PutAsJsonAsync($"{BasePath}/{ExperimentId}/metrics", new
        {
            primaryMetric = new { metricId = Guid.Empty, expectedDirection = "flat" },
            guardrailMetrics = new[] { new { metricId = Guid.Empty, direction = "flat" } }
        });

        await Verify(response);
    }

    [Fact]
    public async Task UpdateMetrics_IgnoresUnmappedFields()
    {
        var metricId = Guid.NewGuid();
        var service = new Mock<IExperimentService>();
        service.Setup(x => x.UpdateMetricsAsync(TestWorkspace.Id, ExperimentId,
                It.Is<ExperimentMetricsUpdate>(update => update.PrimaryMetric.MetricId == metricId &&
                    update.PrimaryMetric.ExpectedDirection == "increase_good" && update.GuardrailMetrics.Count == 0)))
            .ReturnsAsync(new ExperimentDetailVm { Id = ExperimentId, EnvId = TestWorkspace.Id });
        using var factory = CreateFactory(service.Object);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        using var response = await client.PutAsJsonAsync($"{BasePath}/{ExperimentId}/metrics", new
        {
            primaryMetric = new { metricId, expectedDirection = "increase_good", eventName = "ignored" },
            metricEvent = "purchase",
            guardrailMetrics = Array.Empty<object>()
        });

        Assert.True(response.IsSuccessStatusCode);
        service.VerifyAll();
    }

    [Fact]
    public async Task UpdateMetrics_MetricIdsAndDirections_ReturnSuccess()
    {
        var metricId = Guid.NewGuid();
        var guardrailId = Guid.NewGuid();
        var service = new Mock<IExperimentService>();
        service.Setup(x => x.UpdateMetricsAsync(TestWorkspace.Id, ExperimentId,
                It.Is<ExperimentMetricsUpdate>(update => update.PrimaryMetric.MetricId == metricId &&
                    update.PrimaryMetric.ExpectedDirection == "increase_good" && update.GuardrailMetrics.Count == 1 &&
                    update.GuardrailMetrics[0].MetricId == guardrailId && update.GuardrailMetrics[0].Direction == "decrease_bad")))
            .ReturnsAsync(new ExperimentDetailVm { Id = ExperimentId, EnvId = TestWorkspace.Id });
        using var factory = CreateFactory(service.Object);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        using var response = await client.PutAsJsonAsync($"{BasePath}/{ExperimentId}/metrics", new
        {
            primaryMetric = new { metricId, expectedDirection = "increase_good" },
            guardrailMetrics = new[] { new { metricId = guardrailId, direction = "decrease_bad" } }
        });

        Assert.True(response.IsSuccessStatusCode);
        service.VerifyAll();
    }

    [Fact]
    public async Task AnalyzeRun_ValidRequest_ReturnsSuccess()
    {
        var service = new Mock<IExperimentService>();
        service
            .Setup(x => x.AnalyzeRunAsync(TestWorkspace.Id, ExperimentId, RunId, It.IsAny<ExperimentRunAnalyzeRequest>()))
            .ReturnsAsync(new ExperimentDetailVm { Id = ExperimentId, EnvId = TestWorkspace.Id });
        using var factory = CreateFactory(service.Object);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PostAsJsonAsync(
            $"{BasePath}/{ExperimentId}/runs/{RunId}/analyze",
            new { forceFresh = true });

        Assert.True(response.IsSuccessStatusCode);
        service.VerifyAll();
    }

    [Fact]
    public async Task AnalyzeRun_MissingPrimaryMetricSnapshot_ReturnsUnprocessableEntity()
    {
        var service = new Mock<IExperimentService>();
        service
            .Setup(x => x.AnalyzeRunAsync(TestWorkspace.Id, ExperimentId, RunId, It.IsAny<ExperimentRunAnalyzeRequest>()))
            .ThrowsAsync(new BusinessException(ErrorCodes.ExperimentRunPrimaryMetricSnapshotMissing));
        using var factory = CreateFactory(service.Object);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        using var response = await client.PostAsJsonAsync(
            $"{BasePath}/{ExperimentId}/runs/{RunId}/analyze",
            new { forceFresh = true });

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.NotNull(body);
        Assert.False(body.Success);
        Assert.Equal(ErrorCodes.ExperimentRunPrimaryMetricSnapshotMissing, Assert.Single(body.Errors));
        service.VerifyAll();
    }

    [Fact]
    public async Task GetList_OpenApiAccessToken_ReturnsSuccess()
    {
        var experimentService = new Mock<IExperimentService>();
        experimentService
            .Setup(x => x.GetListAsync(TestWorkspace.Id, It.IsAny<ExperimentFilter>()))
            .ReturnsAsync(new PagedResult<ExperimentVm>(0, []));
        var accessTokenService = CreateAccessTokenService();
        var organizationService = new Mock<IOrganizationService>();
        organizationService
            .Setup(x => x.GetAsync(TestWorkspace.OrganizationId))
            .ReturnsAsync(new Organization(TestWorkspace.Id, "Test organization", "test-org")
            {
                Id = TestWorkspace.OrganizationId,
                Initialized = true
            });
        using var factory = CreateFactory(
            experimentService.Object,
            accessTokenService.Object,
            organizationService.Object);
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(PersonalToken);

        var response = await client.GetAsync(BasePath);

        Assert.True(response.IsSuccessStatusCode);
        experimentService.VerifyAll();
    }

    private Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> CreateFactory(
        IExperimentService experimentService,
        IAccessTokenService? accessTokenService = null,
        IOrganizationService? organizationService = null) =>
        _app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Scoped(_ => experimentService));
            if (accessTokenService is not null)
            {
                services.Replace(ServiceDescriptor.Scoped(_ => accessTokenService));
            }

            if (organizationService is not null)
            {
                services.Replace(ServiceDescriptor.Scoped(_ => organizationService));
            }
        });

    private static Mock<IAccessTokenService> CreateAccessTokenService()
    {
        var token = new AccessToken(
            TestWorkspace.OrganizationId,
            TestUser.Id,
            "Experiment test token",
            AccessTokenTypes.Personal,
            [
                new PolicyStatement
                {
                    Id = "experiment-test",
                    ResourceType = ResourceTypes.Env,
                    Effect = "allow",
                    Actions = [Permissions.CanAccessEnv],
                    Resources = ["env/*"]
                }
            ])
        {
            Token = PersonalToken
        };
        var service = new Mock<IAccessTokenService>();
        service
            .Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<AccessToken, bool>>>()))
            .ReturnsAsync(token);
        service.Setup(x => x.RefreshLastUsedAtAsync(It.IsAny<Guid>())).Returns(Task.CompletedTask);
        return service;
    }
}
