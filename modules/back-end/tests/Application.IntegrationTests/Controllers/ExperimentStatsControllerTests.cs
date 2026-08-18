using System.Net.Http.Json;
using Application.ExperimentStats;
using Application.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Collection(nameof(TestApp))]
[Trait("Category", "Host")]
public class ExperimentStatsControllerTests
{
    private static readonly string QueryPath = $"/api/v1/envs/{TestWorkspace.Id}/experiment-stats/query";
    private readonly TestApp _app;

    public ExperimentStatsControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Query_RequestValidation()
    {
        using var factory = CreateFactory(Mock.Of<IExperimentStatsService>());
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PostAsJsonAsync(QueryPath, new
        {
            flagKey = "",
            metricEvent = "",
            startDate = "2026-06-10",
            endDate = "2026-06-01",
            metricType = "unsupported",
            metricAgg = "median"
        });

        await Verify(response);
    }

    [Fact]
    public async Task Query()
    {
        var stats = new ExperimentStatsVm
        {
            EnvId = TestWorkspace.Id,
            FlagKey = "checkout-onboarding",
            MetricEvent = "checkout_activated",
            Window = new ExperimentStatsWindowVm { Start = "2026-06-01", End = "2026-06-10" },
            Variants =
            [
                new ExperimentVariantStatsVm
                {
                    Variant = "control", Users = 100, Conversions = 10,
                    SumValue = 10, SumSquares = 10, ConversionRate = 0.1, AvgValue = 0.1
                },
                new ExperimentVariantStatsVm
                {
                    Variant = "treatment", Users = 100, Conversions = 15,
                    SumValue = 15, SumSquares = 15, ConversionRate = 0.15, AvgValue = 0.15
                }
            ]
        };
        var service = new Mock<IExperimentStatsService>();
        service.Setup(x => x.QueryAsync(It.IsAny<QueryExperimentStats>())).ReturnsAsync(stats);
        using var factory = CreateFactory(service.Object);
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PostAsJsonAsync(QueryPath, new
        {
            flagKey = "checkout-onboarding",
            metricEvent = "checkout_activated",
            startDate = "2026-06-01",
            endDate = "2026-06-10",
            metricType = "binary",
            metricAgg = "once"
        });

        await Verify(response);
    }

    private Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> CreateFactory(
        IExperimentStatsService service) =>
        _app.WithServices(services =>
            services.Replace(ServiceDescriptor.Scoped(_ => service)));
}
