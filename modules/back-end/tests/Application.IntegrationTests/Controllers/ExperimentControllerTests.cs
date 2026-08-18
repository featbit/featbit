using System.Linq.Expressions;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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
            metricName = "",
            metricEvent = "checkout activated",
            metricType = "unsupported",
            metricAgg = "median",
            expectedDirection = "flat",
            guardrails = "[{\"event\":\"latency\",\"metricType\":\"binary\",\"metricAgg\":\"once\"}]"
        });

        await Verify(response);
    }

    [Fact]
    public async Task AnalyzeRun_ValidRequest_ReturnsSuccess()
    {
        var service = new Mock<IExperimentService>();
        service
            .Setup(x => x.AnalyzeRunAsync(TestWorkspace.Id, ExperimentId, RunId, It.IsAny<ExperimentRunAnalyzeRequest>()))
            .ReturnsAsync(new ExperimentDetailVm { Id = ExperimentId, FeatBitEnvId = TestWorkspace.Id });
        using var factory = CreateFactory(service.Object);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PostAsJsonAsync(
            $"{BasePath}/{ExperimentId}/runs/{RunId}/analyze",
            new { forceFresh = true });

        Assert.True(response.IsSuccessStatusCode);
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
